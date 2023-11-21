// lightweight i/o loading module
// CREDITS: Daniel J. Cucuzza
// DATE: September 8th, 2023

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
			iop.waiting = false;
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
	load_text:async(path, success=(blob)=>{}, failure=(error)=> {})=> {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', path, true);
		xhr.responseType = 'text';
		xhr.onload = () => {
// successful get request
			const callback = xhr.status == 200 ?
				()=> { success(xhr.response); } :
				()=> { failure("file failed to be delivered."); };
			callback();
		}
		xhr.send();
	}
};

export const hll_reader = {

}

// responsible for parsing and returning a valid glTF Javascript object.
// -DC @ 9/24/23
export const gltf_reader = {
// produces a glTF object given a file and returns it in yoink
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
			let magic = gltf_reader.read_ascii(data_view, 0, 4, false);
			const ver_n = data_view.getUint32(4, true);
			const bytes = data_view.getUint32(8, true);

			if(!magic.includes('glTF')) { yoink(error('file is not glTF format.')); return; }
			if(ver_n != 2) { yoink(error('glTF version is not version 2.')); return; }
			if(binary_data.byteLength != bytes) { yoink(error('glb file size mismatch.')); return; }
// According to Khronos, the first chunk will ALWAYS be the JSON chunk. Let's manually parse it.
			if(bytes < HEADER_N + CHUNK_H_N) { yoink(error('file has no room for JSON chunk.')); return; }
			
			const j_bytes = data_view.getUint32(12, true); // # of bytes in the next chunk.
			const j_type = gltf_reader.read_ascii(data_view, 16, 20, false); // chunk type
			if(!j_type.includes('JSON')) { yoink(error('first chunk was not of type JSON.')); return; }
			if(j_bytes > bytes - HEADER_N - CHUNK_H_N) { yoink(error('untrustworthy chunk size.')); return; }
	
			const CHUNK_JSON_N = HEADER_N + CHUNK_H_N;
// load the ascii section:
			const j_ascii = gltf_reader.read_ascii(data_view, CHUNK_JSON_N, CHUNK_JSON_N + j_bytes, false);
			const j_json = JSON.parse(j_ascii);
// now we enter a loop to determine how many binary chunks there are:
			let i0 = CHUNK_JSON_N + j_bytes;
			let ci = 1;
			let bins = [];
			do {
				const chunk_b = data_view.getUint32(i0, true);
				const chunk_t = gltf_reader.read_ascii(data_view, i0 + 4, i0 + 8, false);
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
	read_ascii:(view,i=0,j=0,end=false)=> {
		let ascii = '';
		if(i < 0 || j > view.byteLength) return ascii;
		for(;i<j;i++) ascii += String.fromCharCode(view.getUint8(i, end));
		return ascii;
	},
};
