// -DC @ 10/10/23

import { create_indexed_entity } from '../entities/e_base.js';
import { c_transform } from '../components/transform.js';
import { c_mesh_instance } from '../components/mesh_instance.js';

export const create_mesh_entity = (
	entity_list, // where to concatenate mesh to
	scene_mesh, shader, // what elements does the object control?
	device, format) /* what elements does the application control? */ => {
	const mesh_entity = create_indexed_entity(entity_list, {
		components: [ c_transform, c_mesh_instance, ]
	});
// get refrence to the mesh instance
	mesh_entity.find_component(c_mesh_instance)
		.set_mesh(scene_mesh) // notify the entity we are rendering a specific mesh
		.set_shader(shader, device, format); // notify the entity we are rendering with a specific shader

	return mesh_entity;
}
