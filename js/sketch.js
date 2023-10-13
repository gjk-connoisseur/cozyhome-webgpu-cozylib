// driver code for sketch
// CREDITS: Daniel J. Cucuzza
// DATE: September 24th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.
import { bootstrap_engine } from './main.js'; // program wrapper
import { v3f, v4f, q4f, m4f, m3f } from './algebra.js';	// geometric algebras
import { io, gltf_reader } from './io.js'; // importing/exporting, etc.

import { gfx } from './gfx.js';	// general graphics purposes
import { scene_transitive, scene_context, compute_scene_hierarchy } from './scene.js'; // scene manager
import { parse_wshader } from './shaders.js'; // wshader parser

import { object_list, uid_handler } from './state.js';
import { c_transform } from './components/transform.js';
import { c_view } from './components/view.js';

import { create_indexed_entity } from './entities/e_base.js';
import { create_mesh_entity } from './entities/e_mesh.js';

import { dual_frame, dual_view } from './dual.js';

// entry function for the simulation to start.
window.addEventListener("load", (event) => bootstrap_engine(sketch));

const sketch = {
// centers the canvas element in the DOM
	popout_view:(self, props) => {
// reposition the canvases into the center of the document
		const canvas_wgpu = props.wgpu.ctx.canvas;

		const popup_window = window.open('', 'Popup',
			`width=${canvas_wgpu.width}, height=${canvas_wgpu.height}`
		);
		popup_window.document.write('');
		popup_window.document.appendChild(canvas_wgpu);
		props.overwrite_input_window(popup_window);
		
		const resize_event=() => {
			const device = props.wgpu.device;
			const format = props.wgpu.format;
			const queue = device.queue;
			const ctx = props.wgpu.ctx;

			ctx.canvas.width = popup_window.innerWidth;
			ctx.canvas.height = popup_window.innerHeight;
			ctx.configure({ device: device, format: format, usage: GPUTextureUsage.COPY_DST });
			props.swapchain.resize(props.wgpu.device, ctx.getCurrentTexture());
			
			const v0 = props.v0;
			v0.set_projection(gfx.perspective(ctx.canvas.width, ctx.canvas.height));
			v0.bind(device, queue);

// redraw the screen after a resize:
			self.pulse(self, props);
		}

		let timeout = {};
		popup_window.addEventListener('resize', resize_event);
	},
	load: async(self, props) => {
		const width = 512; const height = 384;
// appending a webgpu canvas to the center view tree element.

		props.wgpu = await props.create_web_gpu_canvas(width, height, "WebGPU");
		props.set_frame_rate(120);

		const device = props.wgpu.device;
		const queue = device.queue;

		props.v0 = new dual_view(
			gfx.perspective(width, height), 
			m4f.shift(v4f.vec(5,3,10,1))
		);
		props.v0.bind(device, queue);

// read shader file. GET request:
		(() => {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', './js/test.rs', true);
			xhr.responseType = 'blob';
			xhr.onload = () => {
				if(xhr.status == 200) {
					parse_wshader(device, xhr.response, (data) => {
						props.group0 = data.bind_native_group(device,
							data.native_groups[0],
							props.v0.group()
						);
						props.wshader = data;
					});
				}
			}
			xhr.send();
		})();
// read glb file. GET request:
		(() => {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', './hierarchy3.glb', true);
			xhr.responseType = 'blob';
			xhr.onload = () => {
				if(xhr.status == 200) {
					gltf_reader.read_glb(xhr.response, (ret) => {
						self.open_gltf(self, ret.data, props);
					});
				}
			}
			xhr.send();
		})();
	},
	open_gltf:(self, data, props) => {
		const device = props.wgpu.device;
		const queue = device.queue;
		const wshader = props.wshader;
	
		props.sc_context = new scene_context(data);
		props.sc_context.store_all(device, queue);

		props.r_pipeline = wshader.build_pipeline(device, {
			targets: [ { format: props.swapchain.format } ],
			primitive: { topology:'triangle-list', cullMode: 'back' },
			depthStencil: { depthWriteEnabled: true, depthCompare: "less", format: "depth24plus" },
		});

		props.displays = [];
// construct a frame for each model in the hierarchy
		compute_scene_hierarchy(data, data.graph.scenes[0], (node, mesh_id) => {
// don't care about non-leaf nodes
			if(mesh_id === undefined) return;
// construct a GPU-matrix for each global matrix
			const frame = new dual_frame(node.matrix);
// tell the GPU we want to create a matrix
			frame.bind(device, queue);
// construct a gpu group out of a native group for each object
			const group = wshader.bind_native_group(device,
				wshader.native_groups[1], frame.group()
			);
			props.displays.push(create_display_entity(
				props.r_pipeline, // pipeline
				wshader, // shader
				props.sc_context.get_mesh(mesh_id+1),
				(pass) => { pass.setBindGroup(1, group); }
			));
		});

		const entity_list = new object_list(new uid_handler(), {});
		const entity = create_mesh_entity(entity_list,
			props.sc_context.get_mesh(1),
			props.wshader, device, queue, props.swapchain.format
		);
	},
	start:async(self, props) => {
//		self.popout_view(self, props);

		const device = props.wgpu.device;
		const ctx = props.wgpu.ctx;
		props.swapchain = gfx.create_swapchain(ctx.getCurrentTexture(), device, props.wgpu.format);

	},
	pulse:(self, props) => {
		const swchain = props.swapchain;
		const ctx = props.wgpu.ctx;

		swchain.refresh(ctx.getCurrentTexture());

		const encoder = props.wgpu.device.createCommandEncoder();
		self.draw(self, swchain, encoder, props);

		swchain.flush(ctx, encoder);

		props.wgpu.device.queue.submit([encoder.finish()]);
	},
	draw:(self, swchain, encoder, props) => {
		if(!props.displays) return;

		const et = props.elapsedTime() / 1000;
		const dt = props.deltaTime() / 1000;

		const device = props.wgpu.device;
		const queue = device.queue;

// begin the draw call
		swchain.clear(encoder, (pass) => {
			props.displays.forEach((el) => {
				el.draw(pass, props.group0)
			});
		}, 0, 0, 0.3);
	}
}

// returns a draw call that when ran, will draw the mesh and its required properties.
const create_display_entity = (pipeline, shader, mesh, customize_pass) => {
// set the vertex buffer attributes for a draw call.
	const match_vertex_buffer=(pass, attributes) => {
		for(const attr in shader.attribute_map) {
			const location = shader.attribute_map[attr].location;
			if(attributes[attr] != null) {
				pass.setVertexBuffer(location, attributes[attr].buffer);
			}
		}
	}
// draw call
	const draw = (pass, view_group) => {
		pass.setPipeline(pipeline);
		pass.setBindGroup(0, view_group);
		customize_pass(pass);
// match vertex attributes			
		match_vertex_buffer(pass, mesh.attributes);
		mesh.draw_indexed(pass);
	}
	return { draw };
}

