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
};
