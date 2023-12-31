{
    "bind_groups": {
        "VIEW_GROUP":"0",
        "OBJECT_GROUP":"1"
    },
	"name":"debug_pnu",
	"vertex": {
		"entry":"vmain",
		"code":"
		@tag(perspective_projection_matrix) @group(0) @binding(0) var<uniform> prj_m: mat4x4f;
		@tag(inverse_view_matrix) @group(0) @binding(1) var<uniform> ivw_m: mat4x4f;

		@tag(local_to_world_matrix) @group(1) @binding(0) var<uniform> mdl_m: mat4x4f;
		@tag(inverse_transpose_local_to_world_matrix) @group(1) @binding(1) var<uniform> itm_m: mat4x4f;

// attribute-to-vertex
		struct a2v {
// mark glTF vertex attributes with @attribute= tag.
			@location(0) @attribute=POSITION    pos: vec3<f32>, // position
			@location(1) @attribute=NORMAL      nor: vec3<f32>, // normal
			@location(2) @attribute=TEXCOORD_0   uv: vec2<f32>, // uv
		};

// vertex-to-fragment
		struct v2f {
			@builtin(position) 	pos: vec4<f32>,
			@location(1) 		nor: vec3<f32>,
			@location(2)		 uv: vec2<f32>,
		};

		@vertex fn vmain (va: a2v) -> v2f {
			var o: v2f; // out

			o.uv = va.uv;
// mvp transformation
			o.pos = prj_m*ivw_m*mdl_m*vec4(va.pos, 1);

			let vnor = ivw_m * itm_m * vec4(va.nor, 0);
			o.nor = vec3(vnor.x, vnor.y, vnor.z);
			return o;
		}"
	},
	"fragment": {
		"entry":"fmain",
		"code":"

        @tag(albedo_texture) @group(1) @binding(2) var t_albedo : texture_2d<f32>;
        @tag(albedo_sampler) @group(1) @binding(3) var s_albedo : sampler;

		struct v2f {
			@builtin(position)	pos: vec4<f32>,
			@location(1) 	   	nor: vec3<f32>,
			@location(2)		 uv: vec2<f32>
		};

		@fragment fn fmain (o: v2f) -> @location(0) vec4f {
			let ndl = saturate(dot(o.nor, vec3(0,0,1)));
            let col = textureSample(t_albedo, s_albedo, o.uv);
// cutoff
            if(col.a <= 0.5) { 
                discard;
            }
            return col * ndl;
		}"
	}
}
