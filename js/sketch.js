// driver code for sketch
// CREDITS: Daniel J. Cucuzza
// DATE: September 24th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.
import { bootstrap_engine } from './main.js';			     // program wrapper
import { v3f, v4f, q4f, m4f, m3f } from './algebra.js';	     // geometric algebras
import { io, gltf_reader } from './io.js';				     // importing/exporting, etc.

import { gfx } from './gfx.js';							      // general graphics purposes
import { scene_transitive, scene_context, compute_scene_hierarchy } from './scene.js'; // scene manager
import { parse_wshader } from './shaders.js';			      // wshader parser

import { dual_frame, dual_view } from './dual.js';

// entry function for the simulation to start.
window.addEventListener("load", (event)=> bootstrap_engine(sketch));

const sketch = {
// centers the canvas element in the DOM
	center_view:(props)=> {
// reposition the canvases into the center of the document
		const canvas_wgpu = props.wgpu.ctx.canvas;
		const canvas_c2d  = props.c2d.ctx.canvas;
		const center_view = document.getElementById("center_view");

		if(center_view) {
			center_view.appendChild(canvas_wgpu);
			canvas_c2d.style.position = 'absolute';
			center_view.appendChild(canvas_c2d);
		}
	},
	load: async(self, props)=> {
		const width = 512; const height = 384;
// appending a webgpu canvas to the center view tree element.
		props.wgpu = await props.createWebGPUCanvas(width, height, "WebGPU");
		props.c2d = await props.create2DCanvas(width, height, "C2D");
		props.g2d = props.c2d.g2d;
		props.setFrameRate(120);

		const device = props.wgpu.device;
		const queue = device.queue;
		const g2d = props.g2d;

		props.v0 = new dual_view(
			gfx.perspective(g2d.width(), g2d.height()), 
			m4f.shift(v4f.vec(5,3,10,1)),
		);
		props.v0.bind(device, queue);

// uniform read shader file
		(() => {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', './js/test.rs', true);
			xhr.responseType = 'blob';
			xhr.onload = () => {
				if(xhr.status == 200) {
					parse_wshader(device, xhr.response, (data) => {
						props.group0 = data.bind_native_group(device, data.native_groups[0], props.v0.group());
						props.wshader = data;
					});
				}
			}
			xhr.send();
		})();
// read glb file
		(() => {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', './hierarchy3.glb', true);
			xhr.responseType = 'blob';
			xhr.onload = () => {
				if(xhr.status == 200) {
					gltf_reader.read_glb(xhr.response, (ret)=> {
						self.open_gltf(self, ret.data, props);
					});
				}
			}
			xhr.send();
		})();
	},
	open_gltf:(self, data, props)=> {
		const device = props.wgpu.device;
		const queue = device.queue;
		const wshader = props.wshader;
	
		props.sc_context = new scene_context(data);
		props.sc_context.store_all(device, queue);

		props.r_pipeline = wshader.build_pipeline(device, {
			targets: [ { format: props.swapchain.format } ],
			primitive: { topology:'triangle-list', cullMode: 'back' },
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: "less",
				format: "depth24plus",
			},
		});

		props.displays = [];
// construct a frame for each model in the hierarchy
		compute_scene_hierarchy(data, data.graph.scenes[0], (node, mesh_id)=> {
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
			props.displays.push(create_entity_display(
				props.r_pipeline, // pipeline
				wshader, // shader
				props.sc_context.get_mesh(mesh_id+1),
				(pass) => { pass.setBindGroup(1, group); }
			));		
		});
	},
	start:async(self, props)=> {
		self.center_view(props);

		const device = props.wgpu.device;
		const ctx = props.wgpu.ctx;
		props.swapchain = gfx.createSwapchain(ctx.getCurrentTexture(), device, props.wgpu.format);
	},
	pulse:(self, props)=> {
		const g2d = props.g2d;
		g2d.refresh();
		g2d.clear();
		g2d.aliasing(true);

		const swchain = props.swapchain;
		const ctx = props.wgpu.ctx;

		swchain.refresh(ctx.getCurrentTexture());

		const encoder = props.wgpu.device.createCommandEncoder();
		self.draw(self, swchain, encoder, props);

		swchain.flush(ctx, encoder);

		props.wgpu.device.queue.submit([encoder.finish()]);
	},
	on_key_up:(self, props, event)=> {
		const kc = event.keyCode;

		if(props.keys == null) {
			props.keys = new Set();
			props.keys.add(kc);
		}else {
			if(props.keys.has(kc)) {
				props.keys.delete(kc);
			}
		}
	},
	on_key_down:(self, props, event)=> {
		const kc = event.keyCode;
		if(props.keys == null) {
			props.keys = new Set();
			props.keys.add(kc);
		}else {
			if(!props.keys.has(kc)) {
				props.keys.add(kc);
			}
		}
	},
	draw:(self, swchain, encoder, props)=> {
		if(!props.displays) return;

		const et = props.elapsedTime() / 1000;
		const dt = props.deltaTime() / 1000;

		const device = props.wgpu.device;
		const queue = device.queue;

		if(props.keys != null) {
			const has = (kc)=> props.keys.has(kc);
			let wish = v4f.vec(0, 0, 0, 0);
			if(has(87)) { wish[2] -= 1; }
			else if(has(83)) {
				wish[2] += 1;
			}
			if(has(65)) { wish[0] -= 1; }
			else if(has(68)) { wish[0] += 1; }
			
			if(has(81)) { wish[1] += 1; }
			else if(has(69)) { wish[1] -= 1; }

			const view = props.v0.get_view().slice();
			const delta = m4f.map(view, wish);
			v4f.unit(delta, delta);

			for(let i=0;i<3;i++) view[12+i] += delta[i]*2*dt;
			props.v0.set_view(view);
			props.v0.bind(device, queue);
		}

// begin the draw call
		swchain.clear(encoder, (pass) => {
			props.displays.forEach((el)=> { 
				el.draw(pass, props.group0)
			} );
		}, 0, 0, 0.3);
	}
}

// returns a draw call that when ran, will draw the mesh and its required properties.
const create_entity_display = (pipeline, shader, mesh, customize_pass) => {
// set the vertex buffer attributes for a draw call.
	const match_vertex_buffer=(pass, attributes)=> {
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
