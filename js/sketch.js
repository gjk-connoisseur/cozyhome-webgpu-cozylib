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

import { c_mesh_instance } from './components/mesh_instance.js';

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
			v0.set_projection(gfx.perspective(ctx.canvas.width / ctx.canvas.height));
			v0.bind(device, queue);
// redraw the screen after a resize:
			self.pulse(self, props);
		}

		let timeout = {};
		popup_window.addEventListener('resize', resize_event);
	},
	center_view:(self, props) => {
		const center_view = document.getElementById("center_view");
		const canvas_wgpu = props.wgpu.ctx.canvas;

		if(center_view) { center_view.appendChild(canvas_wgpu); }

		props.overwrite_input_window(window);
	},
	load: async(self, props) => {
		const width = 512; const height = 384;
// appending a webgpu canvas to the center view tree element.

		props.wgpu = await props.create_web_gpu_canvas(width, height, "WebGPU");
		props.set_frame_rate(120);

		const device = props.wgpu.device;
		const queue = device.queue;

		props.v0 = new dual_view(
			gfx.perspective(width / height),
			m4f.stack(
				m4f.shift(v4f.vec(0,5,3,1)),
				m4f.rotx(-Math.PI/8),
				m4f.identity(),
			)
		);

		props.v0.bind(device, queue);

		io.load_image('./chest_0.png', (image)=> {
			createImageBitmap(image)
			.then((bitmap) => {
				const tex = gfx.upload_bitmap(device, queue, bitmap);
				props.stone_tex = tex;
			});
		});

// read shader file. GET request:
		(() => {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', './js/debug_tex.rs', true);
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
			xhr.open('GET', './geometry/chest_0.glb', true);
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

		props.sampler = device.createSampler({
			addressModeU:"clamp-to-edge", addressModeV:"clamp-to-edge",
			magFilter:"nearest", minFilter:"nearest", mipmapFilter:"nearest",
		});
	},
	open_gltf:(self, data, props) => {
		const device = props.wgpu.device;
		const queue = device.queue;
		const wshader = props.wshader;
	
		props.sc_context = new scene_context(device, queue, data);

		props.ent_list = new object_list(new uid_handler(), {});
// construct a frame for each model in the hierarchy
		compute_scene_hierarchy(data, data.graph.scenes[0], (node, mesh_id) => {
// don't care about non-leaf nodes
			if(mesh_id === undefined) return;
// construct l2w, l2w_iv, l2w_ivt
			const frame = new dual_frame(node.matrix);
// construct a gpu group out of a native group for each object
			const mesh_entity = create_mesh_entity(
				props.ent_list, props.sc_context.get_mesh(mesh_id+1),
				props.wshader, device, queue, props.swapchain.format
			);

			const mesh_c = mesh_entity.find_component(c_mesh_instance);

			const set_l2w = mesh_c.set_local_to_world_matrix;
			const set_ivt = mesh_c.set_inverse_transpose_local_to_world_matrix;

			const set_tex = mesh_c.set_albedo_texture;
			const set_sampler = mesh_c.set_albedo_sampler;

			if(set_l2w != null) { set_l2w(queue, frame.l2w()); }
			if(set_ivt != null) { set_ivt(queue, frame.l2w_ivt()); }
			if(set_tex != null) { set_tex(queue, props.stone_tex.tex_handler); }
			if(set_sampler != null) { set_sampler(queue, props.sampler); }
// tell the mesh we are ready to bind our native groups 
// to the remote device. -DC@ 10/22/23.
			mesh_c.bake_uniforms(device);
		});
	},
	start:async(self, props) => {
		const device = props.wgpu.device;
		const ctx = props.wgpu.ctx;
		props.swapchain = gfx.create_swapchain(ctx.getCurrentTexture(), device, props.wgpu.format);

		self.center_view(self, props);
	},
	pulse:(self, props) => {
		const swchain = props.swapchain;
		const ctx = props.wgpu.ctx;

// reassign the current next buffer pointer
		swchain.refresh(ctx.getCurrentTexture());

// initiate the draw pass
		const encoder = props.wgpu.device.createCommandEncoder();
		self.draw(self, swchain, encoder, props);

// flush the contents into the current texture
		swchain.flush(ctx, encoder);

// submit commands to the device
		props.wgpu.device.queue.submit([encoder.finish()]);
	},
	draw:(self, swchain, encoder, props) => {
		const et = props.elapsedTime() / 1000;
		const dt = props.deltaTime() / 1000;

		const device = props.wgpu.device;
		const queue = device.queue;

		props.v0.set_view(
			m4f.stack(
				m4f.roty(et),
				m4f.rotx(-Math.PI/8),
				m4f.shift(v4f.vec(0,1,8,1)),
			)
		);
		props.v0.bind(device, queue);

		const ent_list = props.ent_list;
// begin the draw call
		swchain.clear(encoder, (pass) => {
			pass.setBindGroup(0, props.group0);
			for(let i=1;i < ent_list.length();i++) {
				const ent_renderer = ent_list.get_obj(i);
				if(ent_renderer == null) continue;

				const mesh_c = ent_renderer.find_component(c_mesh_instance);
				if(mesh_c == null) continue;

				mesh_c.draw(pass);
			}
		}, 0.3, 0.4, 0.7);
	}
}
