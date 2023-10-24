// simple wgpu shader preprocessor
// CREDITS: Daniel J. Cucuzza
// DATE: October 1st,  2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

// returns a list of native bind groups and their bindings:
// 'native' as in it has not been baked via the device yet. this will 
// be ran in bind_native_bind_group in the future when it comes time
// to initialize the device bind group.
const compile_native_bind_groups=(device, wson, variables)=> {
	const groups = [];
	for(const variable of variables) {
		const var_group_index = variable['group'];

// determine whether or not this group index has already been found:
		const group_el = groups.find((el)=>el.group_index == var_group_index);

		if(group_el != null) {
			group_el.entries.push({ 
				name: variable.name, 
				type: variable.type, 
				datatype: variable.datatype, 
				binding: variable.binding,
				tag: variable.tag,
				group: var_group_index,
			});
		}else {
			groups.push({
				label: `${wson.name}_bind_group_${var_group_index}`,
				group_index: var_group_index,
				entries: [{ 
					name: variable.name, 
					type: variable.type, 
					datatype: variable.datatype,
					binding: variable.binding,
					tag: variable.tag,
					group: var_group_index,
				}],
			});
		}
	}

// sort groups:
	groups.sort((a,b)=> a.group_index < b.group_index);
	for(const group of groups) {
// sort bindings, delete binding indices
		group.entries.sort((a,b)=> a.binding < b.binding);
		for(const uniform of group.entries) {
			delete uniform.binding;
		}
	}
// construct a layout for each group:
	for(const group of groups) {
		const native_layout = { label: `${group.label}_layout` };
		native_layout.entries = group.entries.map((entry, index) => {
			const type = entry.type;
			const datatype = entry.datatype;

// determine where in the shader the datatype can be found
			let mask = 0;
			mask = wson.vertex.code.includes(datatype)   ? GPUShaderStage.VERTEX   | mask : mask;
			mask = wson.fragment.code.includes(datatype) ? GPUShaderStage.FRAGMENT | mask : mask;

// for later: determine the resource type
			const resource_type=(type)=> { 
				if(type.includes("mat4x4f")) {
					return { buffer: {} }; 
				}else if(type.includes("texture_2d")) {
					return { texture: {} };
				}else if(type.includes("sampler")) {
					return { sampler: {} };
				}
			}

			return { binding: index, visibility : mask, ...resource_type(datatype) };
		});
		group.layout = device.createBindGroupLayout(native_layout);
	}
	return groups;
}

// returns a JSON object containing information about the wshader for use
// in its compilation. This is returned via a callback function due to file reader's
// asynchronous nature
export const parse_wshader=(device, file, yoink=()=>{})=> {
	try {
		const fr = new FileReader();
		fr.onload=()=> {
// remove all C-style comments immediately
			const raw = fr.result.replace(/\/\/.*$/gm, "");

// before baking the shader into a JSON readable format, we are going to construct a 
// lookup list of all binding symbols, and what they map to in regards to group, binding #:
// -DC @ 9/30/23
			const lines = raw.split('\n');

			const group_lines = lines.filter((el) => el.includes("@group"));
			const uniforms = group_lines.map((gline)=> {
// fish for a @tag=
				const tag_token = gline.match(/@tag\([\w_]+\)/);
				const tag = tag_token ? tag_token[0].match(/[\w_]+/g)[1] : -1;

// fish for a @group( number )
				const group_token = gline.match(/@group\(\d+\)/);
// fish for a @binding( number ) 
				const binding_token = gline.match(/@binding\(\d+\)/);

				const group = group_token ? ~~group_token[0].match(/\d+/)[0]  : -1;
				const binding = binding_token ? ~~binding_token[0].match(/\d+/)[0] : -1;

// fish for a var<.... : ...; match var<uniform> name : type;
//				const symbols_token = gline.match(/var[<]*\w+[>]*\s+\w+\w+:\s+\w+/);
				const symbols_token = gline.match(/var[\s\w:<>]*/);

// refactor the symbols tokenizer to account for both types.
// @tag(inverse_transpose_local_to_world_matrix) @group(1) @binding(1) var<uniform> itm_m: mat4x4f;
// @tag(albedo_texture) @group(1) @binding(2) var t_albedo : texture_2d<f32>;

				if(symbols_token != null) {
					const tokens = symbols_token[0].match(/[\w<>]+/g);
					
// invalid variable declaration: skip 
					if(tokens == null || tokens.length < 2) return;

					const type = tokens[0];
					const name = tokens[1];
					const datatype = tokens[2];

					return { name, datatype, type, group, binding, tag };
				}
			});

// we are building an attribute map which takes traditionally understood glTF vertex attributes
// and maps them to the locations specified in WebGPU. 
// -DC @ 10/1/23

// match attributes for the vertex buffer input
			const ATTR_SYMBOLS = [ 
				"@POSITION", "@NORMAL", "@TEXCOORD_0", 
				"@TEXCOORD_1", "@COLOR", "@TANGENT", 
				"@BITANGENT", "@JOINTS", "@WEIGHTS",
				"@POSITION0", "@POSITION1"
			];

			const attribute_map = {};
			const attr_lines = lines.filter((el) => el.includes("@attribute"));
			attr_lines.map((aline)=> {
				const loc_token = aline.match(/@location\(\d+\)/);
				const loc = loc_token ? ~~loc_token[0].match(/\d+/)[0] : -1;

				const attr_token = aline.match(/@attribute=\w+/);
				const attr = attr_token ? attr_token[0].replace(/@attribute=/, "") : -1;

				const type_token = aline.match(/:\s+[<>\w]+/);
				const type = type_token ? type_token[0].replace(/:\s+/, "") : -1;
		
				attribute_map[attr] = { location: loc, type: type };
			});

			const trimmed = raw.replace(/@attribute=\w+\s/g, "") // remove all attribute decorators
				.replace(/@tag\([\w_]+\)/g, "")					 // remove all tag decorators
				.replace(/[\n\b\f\n\t]/g, " "); 				 // remove escape chars

// build datatype from type
			const attr_format = (attr) => {
				const type = attr.type;
				let format = "";

				if(type.includes("<f32>")) 	    format += "float32";
				else if(type.includes("<f16>")) format += "float16";

				if(type.includes("vec4")) 	    format += "x4";
				else if(type.includes("vec3"))  format += "x3";
				else if(type.includes("vec2"))  format += "x2";

				return format;
			}

// build vertex stride from type
			const attr_stride = (attr) => {
				const type = attr.type;
				let stride = 0;
				if(type.includes("<f32>")) 		stride = 4;
				else if(type.includes("<f16>")) stride = 2;

				if(type.includes("vec4")) 	    stride *= 4;
				else if(type.includes("vec3"))  stride *= 3;
				else if(type.includes("vec2"))  stride *= 2;

				return stride;
			}

// build vertex layout
			const build_layout=(format, stride, offset, shaderLocation)=> {
				return { arrayStride: stride, attributes: [{ format,offset, shaderLocation }] }	
			}

// build vertex layouts
			const layouts = Object.values(attribute_map).map(
				(el)=> build_layout(attr_format(el), attr_stride(el), 0, el.location)
			);

			const wson = JSON.parse(trimmed);
// construct the bind groups after parsing since we need the name:
			const native_groups = compile_native_bind_groups(device, wson, uniforms);
// compile vertex
			const vs_module = device.createShaderModule({
				label: `${wson.name}_vertex_module`, code: wson.vertex.code
			});
// compile fragment
			const fs_module = device.createShaderModule({
				label: `${wson.name}_fragment_module`, code: wson.fragment.code
			});

// build pipeline layout from bind groups
			const r_layout = device.createPipelineLayout({
				label: `${wson.name}_pipeline_layout`,
				bindGroupLayouts: native_groups.map((el)=>el.layout),
			});

// simplifies the logic behind constructing a render pipeline:
			const build_pipeline = (dev, props) => dev.createRenderPipeline({
				label: `${wson.name}_pipeline`,
				primitive: props.primitive,
				depthStencil: props.depthStencil,
				layout: r_layout,
				vertex: { module: vs_module, entryPoint: wson.vertex.entry, buffers: layouts },
				fragment: { module: fs_module, entryPoint: wson.fragment.entry, targets: props.targets },
			});

// simplifies pipeline construction even further in the event you just want a basic, depth-written mesh
// to be drawn to the screen:
			const build_basic_pipeline = (dev, format) => {
				return build_pipeline(dev, {
					targets: [ { format } ],
					primitive: { topology:'triangle-list', cullMode: 'back' },
					depthStencil: { depthWriteEnabled: true, depthCompare: "less", format: "depth24plus" }
				});
			}

// pass in an object prototype that all native uniforms will match to. Useful for tag matching or name-matching.
// -DC @ 10/11/23
			const query_native_variable=(match_query)=> {
// store all query parameters we will be matching in an iterable format:
				const keys = Object.keys(match_query);

				return native_groups.reduce( // map all native groups to []
					(result, group) => result.concat( // concatenate [] with all matched variables for this group index.
						group.entries.filter((variable) => // run the (every) across all criteria provided
							keys.every((key) => variable[key] == match_query[key])
						)
					), [] // -> initial array of matched variables
				);
			}

// maps from the "bind_groups" array to the index in the shader.
			const get_native_group_index=(group_type="OBJECT_INDEX") => {
				const bind_groups = wson.bind_groups;
				if(bind_groups === undefined) return undefined;

				const group_index = bind_groups[group_type];
				if(group_index === undefined) return undefined;
// cast to integer
				return ~~(group_index);
			}

// bind function that takes the names of the bind group, and matches them
// to an arguments parameter. this function is responsible for returning an actual
// device bind group, given a native group.
			const bind_native_group=(device, native_group, props)=> {
				return device.createBindGroup({
					label:`${native_group.label}_device`,
					layout: native_group.layout,
					entries: native_group.entries.map((el, index) => {
						if(el.datatype.includes("mat4x4f")) {
							return { binding: index, resource: { buffer: props[el.name] } };
						}else if(el.datatype.includes("texture_2d")) {
							return { binding: index, resource: props[el.name].createView() };
						}else if(el.datatype.includes("sampler")) {
							return { binding: index, resource: props[el.name] };
						}
					}),
				});
			}

			yoink({ 
				wson, // JSON representation of our shader
				native_groups, // variables stored by group category
				build_pipeline, build_basic_pipeline, // helper functions for instancing pipelines
				bind_native_group, query_native_variable, // helper functions for binding/querying variables
				attribute_map, // attributes accepted/required for a vertex pointer.
				get_native_group_index, // maps string descriptors to object indices
			});
		}
		fr.readAsText(file);
	} catch(e) {
		console.log(e);
		yoink(null);
	}
}
