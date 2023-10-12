
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

// TODO: this process can be placed in the preprocessor. It seems like overkill to do
// this FOR EVERY MESH, as this is a PER-SHADER problem.

// ALSO, this MUST be in the preprocessor as the CAMERA view also needs to determine what its
// dependencies must be! Style by economy. Baby steps. Innovate through necessity, not just
// 'because you can'

// Have some 'result' that the mesh instance can query to determine what flags should be set.
// Next step is to write an agent that traverses the hierarchy and determines when/where to
// update branches of the scene hierarchy. This could allow for 'streaming' updates to the
// device, to reduce bandwidth. -DC @ 10/10/23

// we are adopting the 'greedy' philosophy that if a shader 
// contains tags for important matrix uniforms, it MOST LIKELY 
// needs it in order to function. Otherwise, it wouldn't be there. 
// -DC @ 10/10/23

// for sake of type consistency we are going to make some very clear assumptions about how
// our shader is constructed:
		// local_to_world_matrix identifies the global model matrix.
		// inverse_transpose_local_to_world_matrix is the inverse transpose of l2w for normals.

		const variables = [
// -> concatenate more definitions to this later
			'local_to_world_matrix',
			'inverse_transpose_local_to_world_matrix',
			].reduce(
// match tags to native variables in the event they are present:
			(result, tag) => result.concat(shader.query_native_variable({ tag })), 
			[] // -> concatenate to this array after every reduction
		);

// set some flag in the event l2w is needed.
		if(variables.includes('local_to_world_matrix') {

		}

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


