import { bootstrap_engine } from './main.js';			// program wrapper
import { v3f, v4f, q4f, m4f, m3f } from './algebra.js';	// geometric algebras
import { io, gltf } from './io.js';						// importing/exporting, etc.
import { gfx } 	from './gfx.js';						// general graphics purposes
import { shader } from './shaders.js';					// default shaders
import { primitives } from './mesh.js';					// simple meshes

window.addEventListener("load", (event)=> { bootstrap_engine(sketch); });

const sketch = {
	load: async(self, props)=> {
		const width = 1024;
		const height = 768;
// appending a webgpu canvas to the center view tree element.
		props.wgpu = await props.createWebGPUCanvas(width,height, "WebGPU");
		props.c2d = await props.create2DCanvas(width,height,"C2D");
		props.g2d = props.c2d.g2d;
// reposition the canvases into the center of the document
		const canvas_wgpu = props.wgpu.ctx.canvas;
		const canvas_c2d  = props.c2d.ctx.canvas;
		const center_view = document.getElementById("center_view");

		if(center_view) { 
			center_view.appendChild(canvas_wgpu);
			canvas_c2d.style.position = 'absolute';
			center_view.appendChild(canvas_c2d);
		}

		const file_input = document.getElementById('file-input');
		file_input.addEventListener('change', (e)=> {
			gltf.read_glb(e.target.files[0], (ret)=> {
				const data = ret.data;
				const buffers = gltf.find_mesh(data.graph, data.bins, data.graph.meshes[0]);
				const layouts = {
					position: gfx.build_layout('float32x3', 12, 0),
					normal: gfx.build_layout('float32x3', 12, 1),
				}
			});
		});
	},
	start:async(self, props)=> {
		const wgpu 		= props.wgpu; 		// webgpu package
		const g2d		= props.g2d;
		const ctx 		= wgpu.ctx;	  		// webgpu context
		const canvas	= ctx.canvas;		// drawing canvas

		const device 	= wgpu.device;		// GPU device
		const queue		= device.queue;		// draw call queue

// create a double buffer that we will use for the sketch:
		props.swapchain = gfx.createSwapchain(ctx.getCurrentTexture(), device, wgpu.format);

		props.mdl_m = m4f.identity();								// model matrix
		props.ivm_m = m4f.identity();								// inverse view matrix
		props.prj_m = gfx.perspective(g2d.width(), g2d.height());	// projective matrix
		props.itm_m = m4f.transpose(m4f.inverse(props.mdl_m), null); // inverse transpose matrix

		props.cube = primitives.cube();

		props.mdl_bf 	= gfx.init_ubf(device, queue, props.mdl_m, "Model Matrix");
		props.ivm_bf 	= gfx.init_ubf(device, queue, props.ivm_m, "Inverse View Matrix");
		props.prj_bf 	= gfx.init_ubf(device, queue, props.prj_m, "Projection Matrix");
		props.itm_bf 	= gfx.init_ubf(device, queue, props.itm_m, "Inverse Transpose Matrix");

		props.pbuffer 	= gfx.init_vbf(device, queue, props.cube.p_buffer, "Point Buffer");
		props.nbuffer 	= gfx.init_vbf(device, queue, props.cube.n_buffer, "Normal Buffer");
		props.tbuffer	= gfx.init_ibf(device, queue, props.cube.t_buffer, "Index Buffer");

		props.vs_module = device.createShaderModule({ label: "Vertex Shader", code: shader.vs_code });
		props.fs_module = device.createShaderModule({ label: "Fragment Shader", code: shader.fs_code });

		props.bg_layout = device.createBindGroupLayout({
			label: "Bind Group Layout",
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }, 
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: {} },
				{ binding: 2, visibility: GPUShaderStage.VERTEX, buffer: {} },
				{ binding: 3, visibility: GPUShaderStage.VERTEX, buffer: {} }
			]
		});

		props.bgroup = device.createBindGroup({
			label: "Bind Group",
			layout: props.bg_layout,
			entries: [
				{ binding: 0, resource: { buffer: props.mdl_bf } }, // model matrix
				{ binding: 1, resource: { buffer: props.ivm_bf } }, // inverse view matrix
				{ binding: 2, resource: { buffer: props.prj_bf } }, // projective matrix
				{ binding: 3, resource: { buffer: props.itm_bf } }, // projective matrix
			],
		});
		
		props.p_layout = gfx.build_layout('float32x3', 12, 0);
		props.n_layout = gfx.build_layout('float32x3', 12, 1);

		props.r_layout = device.createPipelineLayout({
			label: "Render Pipeline Layout", bindGroupLayouts: [ props.bg_layout ]
		});

		const cformat = props.swapchain.format;
		props.r_pipe = device.createRenderPipeline({
			label: "Render Pipeline", layout: props.r_layout,
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: "less",
				format: "depth24plus",
			},
			vertex:   { module: props.vs_module, entryPoint: "vmain", buffers: [ props.p_layout, props.n_layout ] },
			fragment: { module: props.fs_module, entryPoint: "fmain", targets: [ { format: cformat } ] },
		});
	},
	pulse:(self, props)=> {
		const dt = props.deltaTime() / 1000;
		const et = props.elapsedTime() / 1000;

		const g2d = props.g2d;
		const mat = m3f.shift(v3f.vec(g2d.width()/2,g2d.height()/2,1));

		g2d.set_transform(mat);
		g2d.refresh();
		g2d.clear();
		g2d.aliasing(true);

		self.draw(self, props);
	},
	draw:(self, props)=> {
		const wgpu 		= props.wgpu; 		// webgpu package
		const ctx 		= wgpu.ctx;	  		// webgpu context
		const device 	= wgpu.device;		// GPU device
		const queue		= device.queue;		// draw call queue
		const swchain	= props.swapchain;	// swapchain

		props.mdl_m = m4f.stack(
			m4f.shift(v4f.vec(0,0,-8,1)),
			m4f.roty(props.elapsedTime()/1000),
			m4f.rotz(props.elapsedTime()/1000),
			m4f.rotx(props.elapsedTime()/1000),
			m4f.scale(0.75 + 0.25*Math.cos(props.elapsedTime()/1000)),
		);

		props.itm_m = m4f.transpose(m4f.inverse(props.mdl_m), null); // inverse transpose matrix

		gfx.write_gbf(queue, props.mdl_bf, props.mdl_m);
		gfx.write_gbf(queue, props.itm_bf, props.itm_m);
// it turns out that every redraw causes webgpu's framebuffer texture to change. We'll
// redirect our output to the new one every frame
		swchain.refresh(ctx.getCurrentTexture());
/* DRAW CALLS BEGIN */

// encodes draw calls to gpu queue before submission
		const encoder = device.createCommandEncoder();
// empty the buffered texture before drawing anything
		swchain.clear(encoder, (pass) => {
			pass.setPipeline(props.r_pipe);
			pass.setBindGroup(0, props.bgroup);

			pass.setVertexBuffer(0, props.pbuffer);
			pass.setVertexBuffer(1, props.nbuffer);

			pass.setIndexBuffer(props.tbuffer, "uint16");
			pass.drawIndexed(props.cube.t_buffer.length);
		}, 0, 0, .2, 1);

		swchain.flush(ctx, encoder);
/* DRAW CALLS END */
// tell queue to actually process its render passes and commands
		queue.submit([encoder.finish()]);
	}
}
