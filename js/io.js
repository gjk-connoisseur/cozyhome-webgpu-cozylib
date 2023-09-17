// lightweight i/o loading module
// CREDITS: Daniel J. Cucuzza
// DATE: September 8th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

// i/o private
const iop = { 
	dependants: 0, 
	listener: ()=>{}, 
	waiting:false,
	enqueue:()=> {
		if(!iop.waiting) return;
		iop.dependants++;
	},
// ran by every load operation. Once our dependants are zero, we'll be ready
// to notify the listener.
	dequeue:()=> {
		if(!iop.waiting) return;
		iop.dependants--;
		if(iop.dependants == 0) { 
			iop.listener();
			waiting = false;
		}
	},
};

// accessible functions in i/o
export const io = {
// tell the bootstrapper that we will begin appending dependants.
	begin_sync_load: (listener=()=>{}) => {
		if(iop.waiting) {
			console.warning("We're already waiting..!");
			return;
		}
		iop.dependants = 0;
		iop.listener = listener;
		iop.waiting = true;
	},
	force_close_load:()=> {
		iop.dependants = 0;
		iop.listener = ()=> {};
		iop.waiting = false;
	},
	get_queue_count:()=> iop.dependants,
// image is loaded and passed into the success callback
	load_image:async(path, success=(img)=>{}, failure=(error)=>{})=> {
		iop.enqueue();
		return new Promise((resolve, reject)=> {
			const img = new Image();
// we don't want to actually do anything until the promise returns.
			img.onload  = () => resolve(img);
			img.onerror = reject;
// setting path will fetch from the server.
			img.src = path;
		}).then((img) => { success(img); iop.dequeue(); }).catch(failure);
	},
	read_ascii:(view,i=0,j=0,end=false)=> {
		let ascii = '';
		if(i < 0 || j > view.byteLength) return ascii;
		for(;i<j;i++) ascii += String.fromCharCode(view.getUint8(i, end));
		return ascii;
	},
};

export const gltf = {
	tuple_type:(val)=> {
		if(val == 5120) return "int8";
		else if(val == 5121) return "uint8";
		else if(val == 5122) return "int16";
		else if(val == 5123) return "uint16";
		else if(val == 5125) return "uint_32";
		else if(val == 5126) return "float32";
		else return undefined;
	},
	read_glb:(fd, yoink=()=>{})=> {
		iop.enqueue();

		const error = (msg) => { 
			iop.dequeue();
			return { error: true, data:null, msg:msg }
		}
		const success = (data, msg) => {
			iop.dequeue();
			return { error: false, data:data, msg:'file loaded successfully.' }
		}

		const reader = new FileReader();
		reader.onload = (event) => {
			const HEADER_N = 12; // # of bytes for header
			const CHUNK_H_N = 8; // # of bytes for chunk header

			const binary_data = event.target.result;
			if(binary_data.byteLength < HEADER_N) { 
				yoink(error('file not big enough for glTF header.'));
				return;
			}
		
			const data_view = new DataView(binary_data);
// we begin by reading the file's header 4 bytes at a time.
			let magic = io.read_ascii(data_view, 0, 4, false);
			const ver_n = data_view.getUint32(4, true);
			const bytes = data_view.getUint32(8, true);

			if(!magic.includes('glTF')) { yoink(error('file is not glTF format.')); return; }
			if(ver_n != 2) { yoink(error('glTF version is not version 2.')); return; }
			if(binary_data.byteLength != bytes) { yoink(error('glb file size mismatch.')); return; }
// According to Khronos, the first chunk will ALWAYS be the JSON chunk. Let's manually parse it.
			if(bytes < HEADER_N + CHUNK_H_N) { yoink(error('file has no room for JSON chunk.')); return; }
			
			const j_bytes = data_view.getUint32(12, true); // # of bytes in the next chunk.
			const j_type = io.read_ascii(data_view, 16, 20, false); // chunk type
			if(!j_type.includes('JSON')) { yoink(error('first chunk was not of type JSON.')); return; }
			if(j_bytes > bytes - HEADER_N - CHUNK_H_N) { yoink(error('untrustworthy chunk size.')); return; }
	
			const CHUNK_JSON_N = HEADER_N + CHUNK_H_N;
// load the ascii section:
			const j_ascii = io.read_ascii(data_view, CHUNK_JSON_N, CHUNK_JSON_N + j_bytes, false);
			const j_json = JSON.parse(j_ascii);
// now we enter a loop to determine how many binary chunks there are:
			let i0 = CHUNK_JSON_N + j_bytes;
			let ci = 1;
			let bins = [];
			do {
				const chunk_b = data_view.getUint32(i0, true);
				const chunk_t = io.read_ascii(data_view, i0 + 4, i0 + 8, false);
				bins.push(binary_data.slice(i0 + 8, i0 + 8 + chunk_b));

				i0 += (chunk_b + 8);
// default comparator does not account for whitespace.
				if(!chunk_t.includes('BIN')) { yoink(error(`chunk ${ci} was not of type BIN`)); return; }
				ci++;
			}while(i0 < bytes);

			yoink(success({ graph: j_json, bins:bins })); return;
		}

		reader.onerror = (event) => { yoink(error('failed to load file.')); }
// initiates callback into onload after finishing
		reader.readAsArrayBuffer(fd);
		return;
	},
// locates all necessary information for a given mesh to be draw on screen
	find_mesh:(graph, bins, j_mesh)=> {
		const primitives = j_mesh.primitives[0];
// get the members
		const attributes = primitives.attributes;
		const types = { indices: primitives.indices };
		for(const type in attributes) {
			types[type.toLowerCase()] = attributes[type];
		}
// get all accessor parameters
		const accessors = {};
		for(const type in types) {
			accessors[type] = graph.accessors[types[type]];
		}
// get all buffer views associated with each buffer view in accessors.
		const views = {};
		for(const accessor in accessors) {
			views[accessor] = graph.bufferViews[ accessors[accessor].bufferView ];
		}
// get access to where the memory for each vertex/index buffer is stored in memory.
		const buffers = {};
		for(const view in views) {
			buffers[view] = bins[views[view].buffer];
		}
// now, we'll simplify the data model:
		const mesh = {};
		for(const type in types) {
// we no longer give a shit about indices. If we want to modify our mesh and keep its changes
// separately, we'll need to deep copy it. -DC @ 9/15/23
			mesh[type] = {
				buffer_id:		views[type].buffer,					// what memory are we attached to
				byte_length:	views[type].byteLength,				// where in memory
				byte_offset:	views[type].byteOffset,				// how much of memory
				type:			gltf.tuple_type(accessors[type].componentType), // what tuple?
				tuple_count:	accessors[type].count,				// how many tuples?
				tuple_type: 	accessors[type].type.toLowerCase(),	// what datatype?
			};
		}
		return mesh;
	},
};

