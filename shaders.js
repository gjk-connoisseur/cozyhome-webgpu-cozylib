// lightweight gfx library for helper funcs
// CREDITS: Daniel J. Cucuzza
// DATE: September 9th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.
export const shader = {
	vs_code:`

	@group(0) @binding(0) var<uniform> mdl_m: mat4x4f; // model matrix
	@group(0) @binding(1) var<uniform> ivw_m: mat4x4f; // inverse view matrix
	@group(0) @binding(2) var<uniform> prj_m: mat4x4f; // projection matrix

// attribute-to-vertex
	struct a2v { 
		@location(0) pos: vec3<f32>, // position
		@location(1) nor: vec3<f32>, // normal
	};
// vertex-to-fragment
	struct v2f { 
		@builtin(position) 	pos: vec4<f32>,
		@location(1) 		nor: vec3<f32>,
		@location(2) 		col: vec3<f32>,
	};

	@vertex
	fn vmain(va: a2v) -> v2f {
		var o: v2f; // out

		o.col = vec3(va.pos + 0.5);
// mvp transformation
		o.pos = prj_m*mdl_m*ivw_m*vec4(va.pos, 1);

		let vnor = mdl_m*vec4(va.nor, 1);
		o.nor = vec3(vnor.x, vnor.y, vnor.z);
		return o;
	}`,
	fs_code:`

	struct v2f { 
		@builtin(position) 	pos: vec4<f32>,
		@location(1) 	   	nor: vec3<f32>,
		@location(2) 	   	col: vec3<f32>,
	};

	@fragment
	fn fmain(o: v2f) -> @location(0) vec4f {
		let ndl = saturate(dot(o.nor, vec3(0,0,-1)));
		return vec4(o.col.x*ndl, o.col.y*ndl, o.col.z*ndl, 1);
	}`,
};
