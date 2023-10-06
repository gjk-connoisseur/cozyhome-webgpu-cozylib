// lightweight state machine wrapper
// CREDITS: Daniel J. Cucuzza
// DATE: September 8th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

import { io } from './io.js';
import { gfx } from './gfx.js';

// construct a canvas element that we will draw to.
const create_canvas=(w=1280, h=720, name=null)=> {
	const wcanvas = document.createElement("canvas");
	wcanvas.id = name;
	wcanvas.width = w;
	wcanvas.height = h;

	return wcanvas;
}
// create a gameloop that we will inject draw calls into.
const create_pulse=()=> {
	const heart = {
		start: (think=(heart)=>{}, entity, props) => {
			heart.duration = 1000 / props.fps;
			heart.c_time = heart.s_time = performance.now();
			heart.n_time = heart.s_time + heart.duration;
			heart.dt = 0;
			heart.think = think;
			heart.pulse(0);
// give information to the simulation
			props.elapsedTime = () => heart.c_time;
			props.deltaTime   = () => heart.dt;

			heart.entity = entity; // who is pulsing?
			heart.props = props;   // what are its properties?
		},
		pulse: (t_stamp) => {
// differentiate change in time
			heart.dt = t_stamp - heart.c_time;
// calculate elapsed time
			heart.c_time = t_stamp - heart.s_time;

			if(heart.beat()) { heart.think(heart.entity, heart.props); }

			window.requestAnimationFrame(heart.pulse);
		},
// measure how much time has changed and dictate whether or not we should pulse.
		beat: () => {
			const t_dif = heart.c_time - heart.n_time;
			const t_len = heart.duration;
			const update = t_dif > 0;
			if(update) {
// this is to prevent "catchup" from occurring. this is one of those lines of code
// you need to write down on a piece of paper to understand fully.
				heart.n_time += Math.ceil(t_dif/t_len)*t_len;
			}
			return update;
		}
	}
	return heart;
}

// call this function in order to initiate your state machine sketch
export const bootstrap_engine= async(self)=> {
	const props = {};
	props.setFrameRate=(fps=60)=>{ props.fps = fps; }
	props.createCanvas=(width=400,height=400,name="")=> {
		return create_canvas(width, height, (name == "" || name == null) ? "canvas" : name);
	}
// initializes a webgpu context via a device driver
	props.createWebGPUContext = async (canvas)=> {
		const on_error = (msg) => { error: true, msg };

		if(!canvas) return on_error("canvas was null.");
		const adapter = await navigator.gpu.requestAdapter({ 
			powerPreference: "high-performance" 
		});

		if(!adapter) return on_error("adapter was null.");
		const device = await adapter.requestDevice();
		if(!device) return on_error("device was null.");
	
		const ctx = canvas.getContext("webgpu");
		if(!ctx) return on_error("context was null.");

		const format = navigator.gpu.getPreferredCanvasFormat();
		ctx.configure({ device:device, format:format, usage: GPUTextureUsage.COPY_DST });
		return { error:false, device, ctx, format };
	}

	props.createCanvas2DContext = async(canvas)=> {
		const on_error = (msg) => { error: true, msg };
		if(!canvas) return on_error("canvas was null.");
		const ctx = canvas.getContext("2d");
		if(!ctx) return on_error("context was null.");
		const g2d = new gfx.g2d(ctx);
		return { error:false, ctx, g2d };
	}

	props.createWebGPUCanvas = async(width=400,height=400,name="")=> {
		const canvas = props.createCanvas(width,height,name);
		return await props.createWebGPUContext(canvas);
	}

	props.create2DCanvas = async(width=400,height=400,name="")=> {
		const canvas = props.createCanvas(width,height,name);
		return await props.createCanvas2DContext(canvas);
	}

	props.setFrameRate(60);
// click operations
	if(self.on_click) window.addEventListener("click", (event) => self.on_click(props, event));
	if(self.on_click_down) window.addEventListener("mousedown", (event) => self.on_click_down(props, event));
	if(self.on_click_up) window.addEventListener("mouseup", (event) => self.on_click_up(props, event));
	
// key operations
	if(self.on_key) window.addEventListener("key", (event) => self.on_key(self, props, event));
	if(self.on_key_down) window.addEventListener("keydown", (event) => self.on_key_down(self, props, event));
	if(self.on_key_up) window.addEventListener("keyup", (event) => self.on_key_up(self, props, event));
	
	const begin_sim=()=> {
		if(self.start) self.start(self, props);
		if(self.pulse) create_pulse().start(self.pulse, self, props);
	}

// notify i/o what we should do once all of our load requests are fulfilled.
	io.begin_sync_load(begin_sim);
// begin i/o load:
	if(self.load) await self.load(self, props);

// if nothing was queued, start anyways.
	if(io.get_queue_count() == 0) {
		begin_sim();
		io.force_close_load();
	}
}
