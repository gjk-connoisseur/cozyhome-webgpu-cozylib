// lightweight gfx library for helper funcs
// CREDITS: Daniel J. Cucuzza
// DATE: September 8th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

import { m3f } from './algebra.js';

export const gfx = {
// wrapper for ctx with more functionality for our particular
// use case. This will also allow for context switching if we want
// multiple instances of g2d, with only one ctx.
	g2d: class {
		constructor(ctx) {
			this.ctx = ctx;
			this.stroke_enabled = true;
			this.fill_enabled 	= false;
			this.alias	 		= true;
			this.stroke_style 	= `rgb(0,0,0)`;
			this.fill_style 	= `rgb(0,0,0)`;

			this.transform = m3f.identity();
			ctx.setTransform(this.transform);
		}
// draws with fill or stroke depending on gtx state
		draw() {
			const ctx = this.ctx;
			if(this.stroke_enabled) ctx.stroke();
			if(this.fill_enabled) ctx.fill();
		}
// clears the canvas
		clear() {
			const ctx = this.ctx;
			ctx.resetTransform();
			ctx.beginPath();
			ctx.clearRect(0,0,this.width(),this.height());
			ctx.closePath();
			this.set_transform(this.transform);
		}
// call if you want to guarantee the given context state is saved into ctx:
		refresh(ctx=null) {
			if(ctx) this.ctx = ctx;
			this.set_stroke(this.stroke_enabled);
			this.set_fill(this.fill_enabled);
			this.fill(this.fill_style);
			this.stroke(this.stroke_style);
			this.aliasing(this.alias);
			this.set_transform(this.transform);
		}
// set the gtx linear map to the given linear map:
		set_transform(mat3) {
			m3f.copy(mat3, this.transform);
			this.ctx.setTransform(mat3[0], mat3[1], mat3[3], mat3[4], mat3[6], mat3[7]);
		}
// multiplies gtx's linear map by the given linear map:
		mul_transform(mat3) {
			this.transform = m3f.multiply(mat3,this.transform, m3f.identity());
			this.ctx.setTransform(this.ctx);
		}
// sets internal state for this gtx.
		set_stroke(b) { this.stroke_enabled = b; }
		set_fill(b) { this.fill_enabled = b; }
// whether to enabled anti-aliasing
		aliasing(b=false) {	
			this.alias = b;
			this.ctx.imageSmoothingEnabled = b;
		}
// fill color
		fill(r=255, g=255, b=255) { 
			this.fill_style = `rgb(${r} ${g} ${b}`;
			this.ctx.fillStyle = this.fill_style;
		}
// stroke color
		stroke(r=255, g=255, b=255) { 
			this.stroke_style = `rgb(${r} ${g} ${b}`;
			this.ctx.strokeStyle = this.stroke_style;
		}
		vector(x=0,y=0,dx=0,dy=0) { this.line(x,y,x+dx,y+dy); }
		line(x1=0,y1=0,x2=0,y2=0) {
			const ctx = this.ctx;
			ctx.beginPath();
			ctx.moveTo(x1,y1);
			ctx.lineTo(x2,y2);
			this.draw();
			ctx.closePath();
		}
		circle(x=0, y=0, r=1, theta=0, phi=2*Math.PI) {
			const ctx = this.ctx;
			ctx.beginPath();
			ctx.arc(x, y, r, theta, phi, true);
			this.draw();
			ctx.closePath();
		}
		rect_ax(x1=0,y1=0,x2=0,y2=0) { // axial
			const ctx = this.ctx;
			ctx.beginPath();
			ctx.rect(x1,y1,x2-x1,y2-y1);
			this.draw();
			ctx.closePath();
		}
		rect_ex(x=0,y=0,hw=0,hh=0) { // extents
			const ctx = this.ctx;
			ctx.beginPath();
			ctx.rect(x-hw,y-hh,2*hw,2*hh);
			this.draw();
			ctx.closePath();
		}
		width() { return this.ctx.canvas.width; }
		height() { return this.ctx.canvas.height; }
	},
// returns a swap chain that makes double buffer rendering much simpler to deal with.
	create_swapchain:(dst_t, device, format)=> {
		const chain = {
			buf_t:   gfx.create_buffer_texture(device, dst_t),				  // src texture
			dep_t:   gfx.create_buffer_texture(device, dst_t, "depth24plus"), // depth texture
			dst_t: 	 dst_t,													  // dest to write into (Next buffer)
			format:  format,												  // texture format
			resize:  (device, dst_t) => {
				chain.buf_t = gfx.create_buffer_texture(device, dst_t);
				chain.dep_t = gfx.create_buffer_texture(device, dst_t, "depth24plus");
				chain.dst_t = dst_t;

				chain.set_buffer_view();
				chain.set_depth_buffer_view();
			},
			refresh: (next_texture)=> { chain.dst_t = next_texture; },		// run before a flush
			flush:	 (ctx, encoder)=> { gfx.flush(chain.buf_t, chain.dst_t, encoder); }, // draws to buffer
			clear:	 (encoder, render, r=0,g=0,b=0,a=1)=> { // clears the screen
// encompasses a singular draw call:
				const pass = encoder.beginRenderPass({
					colorAttachments:[{
						view: chain.get_buffer_view(),
						clearValue:[r,g,b,a],
						loadOp:"clear", storeOp:"store"
					}],
// enables depth testing via depthStencil in the construction of the render pipeline.
					depthStencilAttachment: {
						view: chain.get_depth_buffer_view(),
						depthClearValue: 1.0,
						depthLoadOp: "clear",
						depthStoreOp: "store",
					},	
				});
				render(pass);
				pass.end();
			},
			set_buffer_view:(descriptor={})=> { chain.b_view = chain.buf_t.createView(descriptor); },
			get_buffer_view:()=> chain.b_view,
			set_depth_buffer_view:(descriptor={})=> { chain.db_view = chain.dep_t.createView(descriptor); },
			get_depth_buffer_view:()=> chain.db_view,
		};

		chain.set_buffer_view();
		chain.set_depth_buffer_view();
		return chain;
	},
// nice wrapper for creating textures that depend on others
	create_buffer_texture:(device, src_tex, cformat=null)=> {
		return device.createTexture({
			size:[src_tex.width, src_tex.height],
			format: cformat != null ? cformat : src_tex.format,
			usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
		});
	},
// flushes a finished texture into destination, useful for double buffering.
	flush:(src_t, dst_t, encoder) => {
		encoder.copyTextureToTexture(
			{ texture: src_t },
			{ texture: dst_t },
			[ dst_t.width, dst_t.height ]
		);
	},
// generate a perspective projection matrix
	perspective:(w_aspect=1.77,n=0.1,f=1000,fov=0.5)=> {
		return WGPU_PERSPECTIVE_MATRIX(fov, w_aspect, n, f);
	},
// generate an orthographic projection matrix
	orthographic:(w_aspect,s=1,n=0.1, f=100)=> {
		return WGPU_ORTHOGRAPHIC_MATRIX(-s*w_aspect, +s*w_aspect, n, f);	
	},
	init_ubf:(device, queue, buf, name)=> gfx.init_gbf(device, queue, buf, name, GPUBufferUsage.UNIFORM),
	init_vbf:(device, queue, buf, name)=> gfx.init_gbf(device, queue, buf, name, GPUBufferUsage.VERTEX),
	init_ibf:(device, queue, buf, name)=> gfx.init_gbf(device, queue, buf, name, GPUBufferUsage.INDEX),
// helper func for initializing a gpubuffer for shader uniforms
	init_gbf:(device, queue, buf, name="", usage=0)=> {
		const gpu_bf = device.createBuffer({
			label: name,
			size:  buf.byteLength,
			usage: usage | GPUBufferUsage.COPY_DST
		});
		gfx.write_gbf(queue, gpu_bf, buf);
		return gpu_bf;
	},
// write to a gpubuffer given a set of offsets. defaulted to zero.
	write_gbf:(queue, gpu_bf, buf)=> { queue.writeBuffer(gpu_bf, 0, buf); },
}

const WGPU_PERSPECTIVE_MATRIX=(fov, aspect, near, far)=> {
    const f = 1 / Math.tan(fov / 2);

    return new Float32Array([
        f/aspect,   0,                        0,        0,
        0,          f,                        0,        0,
        0,          0,(near + far)/(near - far),       -1, /*handedness*/
        0,          0,  2*(near*far/(near-far)),        0
    ]);
}

const WGPU_ORTHOGRAPHIC_MATRIX=(left, right, bottom, top, near, far)=> {
// Each of the parameters represents the plane of the bounding box
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    const row4col1 = (left + right) * lr;
    const row4col2 = (top + bottom) * bt;
    const row4col3 = (far + near) * nf;

    return new Float32Array([
       -2 * lr,        0,        0, 0,
             0,  -2 * bt,        0, 0,
             0,        0,   2 * nf, 0,
      row4col1, row4col2, row4col3, 1
    ]);
}

