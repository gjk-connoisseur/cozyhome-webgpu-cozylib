
// -DC @ 10/9/23
export class c_mesh_instance {
	#_entity;	// entity reference
	#_shader;   // the shader we are rendering with
	#_pipeline; // what render pipeline will we be using?
	#_mesh;     // scene_mesh we are rendering with

	#_uniforms; // bind groups

	constructor(entity) {
		this.#_entity = entity;

		this.#_mesh = null;
		this.#_shader = null;
	}

	set_mesh(mesh) { this.#_mesh = mesh; return this; }
	set_shader(shader, device, format) { 
		if(!(shader && device && format)) {
			console.error('error: set_shader(...) provided one or more null arguments');
			return;
		}

		this.#_shader = shader;
		this.#_pipeline = shader.build_basic_pipeline(device, format);

// wrote some shorthand code that takes care of the needless boilerplate involving depth testing
// and defining what type of primitive mode should be used for rendering. Obviously i'll need to write
// some code to handle the non-standard input, but this will make my life easier for now.

// it is currently 1:17 AM right now. I need to get some sleep. Good development happened tonight. Keep going
// and you will succeed.

// DID: extended the preprocessor to allow for tagging your bind groups with useful information.
// @tag(view) -> signifies the data in that particular bind group is associated with camera views
// @tag(object) -> signifies the data in that particular bind group is associated with object data.

// TODO: Daniel, you'll want to query the native groups of the 
// active shader and build a uniforms list. This way, you'll be able to map from tagged bindings
// to GPU buffers. Then make these uniforms accessible through setters like 'set_world_transform'
	
// build an entity known as the "transform updater" that will handle optimally computing local world space
// finalized matrices for all entities in the scene graph. It will use a Queue just as we did inside of
// scene.js::compute_scene_hierarchy. Have some schema to exit early in the event a path does not need
// to be updated. -DC @ 10/10/23

		return this;
	}

// set the vertex buffer attributes for a draw call.
	match_vertex_buffer (pass) {
		const shader = this.#_shader;
		const mesh = this.#_mesh;

// get all available mesh attributes for this model:
		const attributes = mesh.attributes;

// set the gpu buffers for this render pass
		for(const attr in shader.attribute_map) {
			const location = shader.attribute_map[attr].location;
			if(attributes[attr] != null) {
				pass.setVertexBuffer(location, attributes[attr].buffer);
			}
		}
	}
}

