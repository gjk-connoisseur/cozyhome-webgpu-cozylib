
import { gfx } from '../gfx.js';  // -> need this for buffer allocation
import { m4f } from '../algebra.js'; // -> need for m4f ctor

// -DC @ 10/9/23
export class c_mesh_instance {
	#_entity;	  // entity reference
	#_shader;     // the shader we are rendering with
	#_pipeline;   // what render pipeline will we be using?
	#_mesh;       // scene_mesh we are rendering with
	#_uniforms;   // elements of the 'entries' native group.
	#_bindgroup; // actual gpu bind groups.

	constructor(entity) {
		this.#_entity = entity;
		this.#_bindgroup = null;

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
					if(entry.datatype.includes("mat4x4f")) {
						this.#_uniforms[entry.name] =
						gfx.init_ubf(device, queue, m4f.identity(), 
							`${shader.wson.name}_${this.#_entity.uid()}_${entry.name}`
						 );

						this[`set_${entry.tag}`] = (queue, m4f) => {
							gfx.write_gbf(queue, this.#_uniforms[entry.name], m4f);
						}
					}else if(entry.datatype.includes("texture_2d")) {
						this[`set_${entry.tag}`] = (queue, tex) => {
							this.#_uniforms[entry.name] = tex;
						}
					}else if(entry.datatype.includes("sampler")) {
						this[`set_${entry.tag}`] = (queue, sampler) => {
							this.#_uniforms[entry.name] = sampler;
						}
					}
				});
// create a local function that searches the native group by TAG, and determines which uniforms
// should be set. -DC @ 10/14/23
			}
		}
		return this;
	}
// required to be executed before the first draw instruction is made.
// -DC @ 10/22/23
	bake_uniforms (device) {
		const shader = this.#_shader;
		const uniforms = this.#_uniforms;

		const object_index = shader.get_native_group_index("OBJECT_GROUP");
		if(object_index === undefined) return;

		const object_group = shader.native_groups[object_index];
		if(object_group === undefined) return;

		const object_gpu_group = shader.bind_native_group(
			device, object_group, uniforms
		);

		this.#_bindgroup = { index: object_group, group: object_gpu_group };
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
		const group_bundle = this.#_bindgroup;
		const native = group_bundle.index;
		pass.setBindGroup(native.group_index, group_bundle.group);
	}
// most blank possible way of drawing a mesh.
	draw (pass) {
// not really necessary but will prevent exceptions.
		if(!(this.#_mesh && 
			 this.#_pipeline && 
			 this.#_bindgroup &&
			 this.#_shader)) return;
// render pass consists of context switching:
		pass.setPipeline(this.#_pipeline);
		this.match_vertex_buffer(pass);
		this.match_bind_groups(pass);
		this.#_mesh.draw_indexed(pass);
	}
}
