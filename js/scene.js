// lightweight scene API
// CREDITS: Daniel J. Cucuzza
// DATE: September 24th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

import { io } from './io.js';

import { gfx } from './gfx.js';
import { m4f, v4f, q4f } from './algebra.js';
import { uid_handler, object_list } from './state.js';
import { object_queue } from './state.js';

// human friendly/glTF friendly format for representing transformation matrices:
export class scene_transitive {
	#_shift; #_twist; #_scale;
	#_matrix;
	#_dframe;

	constructor(dframe = null,
			shift = v4f.vec(0,0,0,1),
			twist = q4f.identity(),
			scale = v4f.vec(1,1,1,1)) {
		this.#_shift = shift;
		this.#_twist = twist;
		this.#_scale = scale;
		this.#_dframe = dframe;

		this.apply();
	}
// updates + returns the matrix configuration for shift, twist, scale
	apply=(device=null, queue=null)=> {
		this.#_matrix = m4f.stack(
			m4f.shift(this.#_shift), 	// v4f -> m4f
			q4f.to_m4f(this.#_twist),	// q4f -> m4f
			m4f.scale(this.#_scale),	// v4f -> m4f
		);

		if(this.#_dframe != null) {
			this.#_dframe.set(this.#_matrix);
			if(device != null && queue != null) {
				this.#_dframe.bind(device, queue);
			}
		}
		return this.#_matrix;
	}

	get_shift=(q=v4f.vec(0,0,0,1))=> v4f.copy(this.#_shift, q);
	set_shift=(q=v4f.vec(0,0,0,1))=> v4f.copy(this.#_shift, q);

	get_twist=(q=q4f.identity())=> q4f.copy(this.#_shift, q);
	set_twist=(q=q4f.identity())=> q4f.copy(this.#_shift, q);

	get_scale=(q=v4f.vec(1,1,1,1))=> q4f.copy(this.#_scale, q);
	set_scale=(q=v4f.vec(1,1,1,1))=> q4f.copy(this.#_scale, q);

	capture=(handle=(shift, twist, scale)=>{})=> {
		handle(this.#_shift, this.#_twist, this.#_scale);
		return this;
	}
}

// storage device for all gltf_mesh models in a given context. This class is primarily where
// mesh data will be accessed, loaded, and kept.
export class scene_context {
	#_mesh_registry; // what meshes are stored in this gltf file
	#_image_registry; // what images are stored in this gltf file
	#_texture_registry; // what textures are stored in gltf file (bitmap, sampler)

/*
 * I'd like to refactor this implementation entirely. It seems like we have
 * the following acyclic dependency list for objects in the scene:
 *
 * Materials:
 * 	-> Textures
 *
 * Textures:
 * 	-> Samplers (GPUSamplers/NativeSamplers)
 * 	-> Images (Bitmaps/Blobs/etc)
 *
 * Meshes:
 * 	-> Vertex Buffers
 * 	-> Index Buffers
 * 	-> Material Indices
 * 	-> Skinning Indices
 *
 *	Node:
 *		Transformation Matrix:
 *		Mesh:
 *			Material:
 *				Shader: (implicitly constructed via Material)
 *				Texture:
 *					Image:
 *					Sampler
 *			Vertex Buffer(s)
 *			Index Buffer(s)
 *
 *		TODO: Skinning Code (...)	
 *
 * 	Objects in the .gltf scene are stored in run-length format
 * 	in their respective sublists: (nodes, meshes, materials, textures, etc.)
 *
 *	Obviously, the most straightforward approach to deserializing a .gtlf
 *	scene is bottom up. Determine what elements in the scene are not dependent
 *	on anybody else. This is usually data like images, meshes, etc.
 *
 *	(Read GLTF File) 0. read the .gltf file and successfully convert it into a JSON object.
 *
 *  (Import Bitmaps) 1. index all images into bitmaps and upload to the GPU.
 *  (Import Samplers) 2. index all samplers into GPUSamplers and upload to the GPU.
 *
 *  (Construct NativeTextures) 3. construct a list of native textures via the prior two lists.
 *
 * 	(Import Meshes) 4. index all meshes and upload their vertex attribute buffers to the GPU.
 * 		-> Implement the ability to select between sparse-length versus object-length encoding
 * 		for the attribute buffers in the vertex buffer.
 *
 * 		Basically, have a translation layer that takes the structure in which .gltf files
 * 		store vertex attribute information (sparse-length) and let the user control how it should
 * 		be uploaded to the GPU.
 *
 * <-- WE ARE CURRENTLY HERE @ 10/30/23 -->
 * I want to refactor steps (1-4) with as much clarity as I can afford using a text-editor like Vim
 * and my spare time off of work.
 *
 * (Import Materials) 5. This is very ambiguous at the moment as I do not know the various configurations
 * that materials can take shape in. Materials should obviously come after step 3, though.
 *
 * (Build Scene Graph) 6. At the moment, compute_scene_hierarchy build a scene graph using the TRS-model
 * and can successfully import static scene geometry one-to-one with blender. However, I want a dynamic
 * scene with individual rigidbody transformations affecting their respective children. This is a
 * complicated task and doesn't seem all that necessary for simplistic simulative environments.
 *
 * (Dynamically Build Shaders) 7. Build checksums for various shaders. Index these and reuse them
 * behind the scenes to save on memory. Very vague statements here but the general idea is to generate
 * modular WGPU Rust codeblocks to feed into the shading compiler at run time.
 *
 * (Build Animation Skeletons) 8. Have the ability to import spline animations and map them to scene graph
 * information. This also means mesh-skinning implementations need to be implemented, and implemented
 * efficiently if we want to use them large scale.
 * -DC @ 10/30/23
 *
 */


// build a repository of all meshes stored in the gltf file.
	constructor(device, queue, data) {
		const mesh_graph = data.graph.meshes;
// build a repository of meshes
		const mesh_registry = new object_list(new uid_handler(), {});
		this.#_mesh_registry = mesh_registry;

		let mesh_count = mesh_graph.length+1;
		const on_mesh_loaded=()=> {
			mesh_count--;
			if(mesh_count == 0) {
				this.store_all_meshes(device, queue);
			}
		}

		for(const mesh_type of mesh_graph) {
			mesh_registry.write_obj((args)=> new scene_mesh(args), {
				name:		mesh_type.name,				// name
				primitive: 	mesh_type.primitives[0],	// attributes
				graph: 		data.graph,					// json
				bins:  		data.bins,					// binary
				on_loaded: on_mesh_loaded
			});
		} on_mesh_loaded();

// dependency injection to upload images to WebGPU textures.
		const image_graph = data.graph.images;

		let image_count = image_graph.length+1;
		const on_image_loaded=()=> {
			image_count--;
			if(image_count == 0) {
				this.store_all_images(device, queue);
			}
		}

// build a repository of images
		const image_registry = new object_list(new uid_handler(), {});
		this.#_image_registry = image_registry;

		for(const image_type of image_graph) {
			image_registry.write_obj((args) => new scene_image(args), {
				name:				image_type.name,
				mime_type: 			image_type.mimeType,
				buffer_view_index: 	image_type.bufferView,
				graph: 				data.graph,
				bins: 				data.bins,
				on_loaded: on_image_loaded
			});
		} on_image_loaded();
	}
// load the vertex and element buffers into VRAM
	store_all_meshes(device, queue) {
		const registry = this.#_mesh_registry;
		for(let i=1;i < registry.length();i++) {
			const mesh_obj = registry.get_obj(i);
			if(mesh_obj != null) {
				mesh_obj.store(device, queue);
			}
		}
	}
// load the texture information into VRAM
	store_all_images(device, queue) {
		const registry = this.#_image_registry;

		for(let i=1;i < registry.length();i++) {
			const image_obj = registry.get_obj(i);
			if(image_obj != null) {
				image_obj.store(device, queue);
			}
		}
	}
	get_mesh(index) { return this.#_mesh_registry.get_obj(index); }
}

// a data storage classed used to bundle bitmaps with their samplers
// going forwards, a texture is a composition of a sampler and its 
// underlying bitmap -DC @ 10/29/23
export class scene_texture {
	#_uid; #_image; #_sampler;

	constructor(args) {
		const props = args.props;
	
		const sampler_index = props.sampler_index;
		const source_index = props.source_index;



		this.#_uid = args.uid;
	}
}

// a data storage class that helps convert glb-images to
// webgpu textures -DC @ 10/26/23
export class scene_image {
	#_bitmap; #_handler;
	#_loaded; #_uid; #_name;

	constructor(args) {
		const props = args.props;

		const graph = props.graph;
		const bins = props.bins;

// grab access to the list of various buffer views
		const buffer_views = graph.bufferViews;

// the storage description of this image: { binary index, length, offset } 
		const image_view = buffer_views[props.buffer_view_index];
		const image_blob = new Blob([
			new DataView(
				bins[image_view.buffer],
				image_view.byteOffset, image_view.byteLength
			)], { type: props.mime_type }
		);

		io.load_image(
// convert from a blob type to whichever mime type was described
			URL.createObjectURL(image_blob),
			(image) => {
				createImageBitmap(image)
				.then((bitmap) => {
					this.#_bitmap = bitmap;
// notify callee we are finished loading our data. -DC @ 10/23/23
					if(props.on_loaded != null) {
						props.on_loaded();
					}
			});
		});

		this.#_loaded = false; // whether loaded on GPU or not
		this.#_uid = args.uid; // id in the array
	}

	store(device, queue) {
		if(this.#_loaded) return;
		if(this.#_bitmap == null) {
			console.log(`warning: bitmap not loaded for ${this}`);
			return;
		}

		this.#_handler = gfx.upload_bitmap(device, queue, this.#_bitmap);
	}

	loaded() { return this.#_loaded; }
	uid() { return this.#_uid; }
}

// storage class for raw binary mesh data and its 
// corresponding buffers inside the GPU.
export class scene_mesh {
	#_loaded; #_uid; #_name;

	constructor (args) {
		const props = args.props;

		const primitive = props.primitive;
		const graph = props.graph;
		const bins = props.bins;

		const materials = graph.materials;

		const buffer_views = graph.bufferViews;
		const accessors = graph.accessors;

// { POSITION, NORMAL, TEXCOORD_0 }
		const mesh_attr = {};
		for(const obj in primitive.attributes) {
			const accessor = accessors[ primitive.attributes[obj] ];
			const buffer_view = buffer_views[ accessor.bufferView ];
			const attr = {};
// get the component type and tuple type
			attr.type 		   = accessor.type;
			attr.componentType = accessor.componentType;
// get the buffer view
			attr.byteLength = buffer_view.byteLength;
			attr.byteOffset = buffer_view.byteOffset;
// binary and gpu buffer
			attr.binary	= bins[ buffer_view.buffer ];
			attr.buffer = null;
	
			mesh_attr[obj] = attr;
		}
// handle materials
		if(primitive.material != null) {
			this['material'] = materials[primitive.material];
			console.log(this['material']);
		}

// handle indices
		if(primitive.indices != null) {
			const indices_id = primitive.indices;
			const accessor = accessors[ indices_id ];
			const buffer_view = buffer_views[ accessor.bufferView ];
// buffer views
			const indices = {};
			indices.byteLength = buffer_view.byteLength;
			indices.byteOffset = buffer_view.byteOffset;
// binary and gpu buffer
			indices.binary = bins[ buffer_view.buffer ];
			indices.buffer = null;

			if((indices.byteLength % 4) != 0) {
				indices.byteLength -= indices.byteLength % 4;
				console.log(`${props.name} has element buffer size in non-multiple of 4. Fixing now.`);
			}
			this["INDICES"] = indices;
		}

		this.#_uid = args.uid; // universal context mesh id
		this.#_name = props.name; // name of mesh
		this.#_loaded = false; // whether loaded on GPU or not
		this.attributes = mesh_attr; // all vertex attributes

// run mesh loaded callback after everything is set -DC @ 10/27/23
		if(props.on_loaded != null) {
			props.on_loaded();
		}
	}
// responsible for allocating and storing mesh data to the gpu device.
	store(device, queue) {
		if(this.#_loaded) return;

		for(const type in this.attributes) {
			const attribute = this.attributes[type];

			const binary = attribute.binary;		// typed array of attr data
			const blength = attribute.byteLength;	// amount of bytes total
			const boffset = attribute.byteOffset;	// how far in binary to read from

// allocate memory for the vertex buffer
			const vgpu_buffer = device.createBuffer({
				name: type,
				size: blength,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
			});
			queue.writeBuffer(vgpu_buffer, 0, binary, boffset, blength);
			attribute.buffer = vgpu_buffer;
		}
// load the index buffer
		const attribute = this.INDICES;
		const binary  = attribute.binary;
		const blength = attribute.byteLength;
		const boffset = attribute.byteOffset;

		const igpu_buffer = device.createBuffer({
			name: "INDICES",
			size: blength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
		});
		queue.writeBuffer(igpu_buffer, 0, binary, boffset, blength);
		attribute.buffer = igpu_buffer;

		this.#_loaded = true;
	}

	draw_indexed(pass) {
		pass.setIndexBuffer(this.INDICES.buffer, "uint16");
		pass.drawIndexed(~~(this.INDICES.buffer.size / 2));
	}

	loaded() { return this.#_loaded; }
	uid() { return this.#_uid; }
}

// constructs the global transformation matrices for all of the nodes in a glTF tree.
export const compute_scene_hierarchy=(data, scene, yoink=(node, mesh)=>{})=> {
// build local matrix for this gltf node
	const build_trs=(root)=> {
		const t = root.translation;
		const r = root.rotation;
		const s = root.scale;
		
		let m = m4f.identity();
		if(s != undefined) { 
			s.push(1);
// maintain type consistency. m4f is expecting a v4f, not v3f.
			m = m4f.multiply(m4f.diag(s), m);
		}
		if(r != undefined) {
			m = m4f.multiply(q4f.to_m4f(r), m);
		}
		if(t != undefined) { 
			t.push(1);
// maintain type consistency. m4f is expecting a v4f, not v3f.
			m = m4f.multiply(m4f.shift(t), m);
		}
		return m; // TRS := Translation * Rotation * Scale
	}

	const nodes = data.graph.nodes;
	const node_queue = new object_queue();

// get highest layer of nodes in scene and concatenate to queue in
// order to initiate breadth first query
	for(let i=0;i<scene.nodes.length;i++) {
		const node_index = scene.nodes[i];
		const child_node = { 
			index: node_index,
			matrix: build_trs(nodes[node_index]),
		};
		yoink(child_node, nodes[node_index].mesh);
		node_queue.push(child_node);
	}

// avoid stack-recursion and use breadth-first bleed instead:
	while(node_queue.count() > 0) {
		const node_obj = node_queue.pop();
		const index = node_obj.index;
// parent transform
		const matrix = node_obj.matrix;
		const node = nodes[index];

		const children = node.children;
		if(node.children == null) continue;

// append children for concatenation
		for(let i=0;i<children.length;i++) {
			const child_index = children[i];
// local transform
			const child_matrix = build_trs(nodes[child_index]);
			const child_node = {
				index: child_index,
				matrix: m4f.multiply(matrix, child_matrix)
			}

			yoink(child_node, nodes[child_index].mesh);
			node_queue.push(child_node);
		}
	}
}
