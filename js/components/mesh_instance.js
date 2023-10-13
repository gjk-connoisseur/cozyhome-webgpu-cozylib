
import { gfx } from '../gfx.js';  // -> need this for buffer allocation
import { m4f } from '../algebra.js'; // -> need for m4f ctor

// -DC @ 10/9/23
export class c_mesh_instance {
	#_entity;	// entity reference
	#_shader;   // the shader we are rendering with
	#_pipeline; // what render pipeline will we be using?
	#_mesh;     // scene_mesh we are rendering with

	constructor(entity) {
		this.#_entity = entity;

		this.#_mesh = null;
		this.#_shader = null;
	}

	set_mesh(mesh) { this.#_mesh = mesh; return this; }
	set_shader(shader, device, queue, format) { 
		if(!(shader && device && format)) {
			console.error('error: set_shader(...) provided one or more null arguments');
			return;
		}

		this.#_shader = shader;
		this.#_pipeline = shader.build_basic_pipeline(device, format);

// build a list of dependants we give a shit about
		const linear_maps = {};
		const bind_group_indices = new Set();
		shader.dependants.filter(
			(variable) => [
				"local_to_world_matrix", 
				"inverse_transpose_local_to_world_matrix", 
				"inverse_local_to_world_matrix"
			].includes(variable.tag)
		).forEach((var_matrix) => {
			bind_group_indices.add(var_matrix.group);
			linear_maps[var_matrix.name] = gfx.init_ubf(device, queue, m4f.identity(), 
				`${shader.wson.name}_${this.#_entity.uid()}_${var_matrix.name}`
			);
		});

// after building a list of GPUBuffers, we'll need to bake them into bind groups. We'll use
// a set to keep track of all of the dependencies and their bind groups, so we don't do it
// more than once. -DC @ 10/13/23

// UPDATE: this makes the implicit assumption that the only dependencies for each
// group the maps belong to are already constructed.
// This is particularly a problem as suppose we also have a texture sampler attached
// in a binding for the same group that the linear maps attach to. If we dont set that
// texture, we cant bind the object.

// clearly a lot more meta programming needs to be at play here. I am not ad-hoc'ing this implementation.
// If I do, this repo will end up just like VTK: bloated, fucking convoluted, and NOT STRAIGHTFORWARD.
// THINK MORE ON THIS. Good place to stop development here.

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

