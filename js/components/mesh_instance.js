
import { gfx } from '../gfx.js';  // -> need this for buffer allocation
import { m4f } from '../algebra.js'; // -> need for m4f ctor

// -DC @ 10/9/23
export class c_mesh_instance {
	#_entity;	  // entity reference
	#_shader;     // the shader we are rendering with
	#_pipeline;   // what render pipeline will we be using?
	#_mesh;       // scene_mesh we are rendering with
	#_uniforms;   // elements of the 'entries' native group.
	#_bindgroups; // actual gpu bind groups.

	constructor(entity) {
		this.#_entity = entity;
		this.#_bindgroups = [];

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

// poke into the shader and get us the native group that represents properties 
// intrinsic to the entity/mesh itself.
		const object_index = shader.get_native_group_index("OBJECT_GROUP");
		if(object_index != undefined) {
			const object_group = shader.native_groups[object_index];
			if(object_group != null) {
				this.#_uniforms = {};
// map elements to their GPU counterparts:
				object_group.entries.forEach((entry) => {
// mat4x4f support is most important here.
					if(entry.datatype == 'mat4x4f') {
						this.#_uniforms[entry.name] =
						gfx.init_ubf(device, queue, m4f.identity(), 
							`${shader.wson.name}_${this.#_entity.uid()}_${entry.name}`
						 );

						this[`set_${entry.tag}`] = (queue, m4f) => {
							gfx.write_gbf(queue, this.#_uniforms[entry.name], m4f);
						}
					}
				});

				const object_gpu_group = shader.bind_native_group(
					device, object_group, this.#_uniforms
				);

				this.#_bindgroups.push({ index: object_group, group: object_gpu_group });
// create a local function that searches the native group by TAG, and determines which uniforms
// should be set. -DC @ 10/14/23
			}
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
// assign all of the bind groups associated with this mesh object.
	match_bind_groups (pass) {
		for(const bgroup of this.#_bindgroups) {
			pass.setBindGroup(bgroup.index, bgroup.group);
		}
	}
// most blank possible way of drawing a mesh.
	draw (pass) {
// not really necessary but will prevent exceptions.
		if(!(this.#_mesh && 
			 this.#_pipeline && 
			 this.#_bindgroups &&
			 this.#_shader)) return;

// render pass consists of context switching:
		pass.setPipeline(this.#_pipeline);
		this.match_vertex_buffer(pass);
		this.match_bind_groups(pass);
		this.#_mesh.draw_indexed(pass);
	}
}
