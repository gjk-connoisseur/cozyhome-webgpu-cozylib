// lowest level pure functions for our higher level shading language transpiler.
// -DC @ 11/18/23

// represents the standard model, view, projection tuple. Used in virtually all screen space
// rendering.
struct model_view_projection_t { 
    mdl_m: mat4x4f, 
    ivw_m: mat4x4f, 
    prj_m: mat4x4f
};

// represents the inverse transpose tuple. Used for computing correct viewspace normals 
// as MVP does not do so. 
struct inverse_model_transpose_t { 
    ivw_m: mat4x4f, 
    itm_m: mat4x4f
};

// used to test returning tuples
fn debug_tuple(lmap: model_view_projection_t) -> (vec3<f32>, vec3<f32>) {

}

// used to test no arg funcs
fn debug_empty() {

}

// computes the screen space position of an object space position using an MVP stack.
// -DC @ 11/18/23
fn world_to_screen_position(lmaps: model_view_projection_t, 
    pos: vec3<f32>) -> vec4<f32> {
    return lmap.prj_m * lmap.ivw_m * lmap.mdl_m * vec4(vertex, 1.0);
}

// computes the view space direction of an object space surface normal using an IVT stack.
fn world_to_view_normal(lmaps: inverse_model_transpose_t,
    nor: vec3<f32>) -> vec4<f32> {
    return lmap.ivw_m * lmap.itm_m * vec4(nor, 0);
}
