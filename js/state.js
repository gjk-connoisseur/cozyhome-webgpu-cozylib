// CREDITS: Daniel J. Cucuzza
// DATE: September 19th, 2023
// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

export const state = {
// fsm := state machine, man := data object, 
//init := init state, before := function ran before setup(...) and enter(...)
	init_fse_override:(fsm,man,init,before)=> {
		if(!man) man = CONSTRUCTOR_MAN();
		const ent = { fsm:fsm, man:man } // get entity
		before(ent);
		fsm.setup(man); // invoke all setup functions
		fsm.set(man, init ? init : 'init'); // run the init state
		return ent;
	},
// constructs a default finite state entity (base class most configurations should run)
	init_fse:(fsm, man, init)=> {
		if(!man) man = CONSTRUCTOR_MAN();
		const ent = { fsm:fsm, man:man } // get entity
		fsm.setup(man); // invoke all setup functions
		fsm.set(man, init ? init : 'init'); // run the init state
		return ent;
	},
// constructs a default man object for a FSM
	init_man:()=> {
		const man ={
			_cur:null, // assign first state
			cur:() => { return man._cur; },
			setcur(nxt) { man._cur = nxt; },
		}
		return man;
	}
};

// we assume that our state machine is initialized and does not modify existing
// data that the fsm requires.
export class fsm {
	#_dict;
// states, middleman
	constructor(states) {
		this.assert(states != null && states.length > 0, "state bag was empty or null.");
		this.#_dict = [];
// append all new states to dictionary object
		for(let i = 0;i < states.length;i++) {
			const state = states[i];
			this.vstate(state);
			this.#_dict[state.key] = state;
		}
	}
// update current state
	pulse=(man)=> {
		const cur = man.cur();
		cur.pulse(this, man);
	}
	setup=(man)=> {
		for(const o in this.#_dict) { 
			const stt = this.#_dict[o];
			stt.setup(this, man);
		} 
	}
	remove=(man)=> {
		for(const o in this.#_dict) {
			const stt = this.#_dict[o];
			stt.remove(this, man);
		}
	}
// context switch for next frame
	cswitch=(man, next_key)=> {
		const cur = man.cur();
		const next = this.sget(next_key);
		this.assert(next != null);
		cur.exit(next_key, this, man); 		// Notify old state of man that its leaving
		man.setcur(next);					// Context switch
		next.enter(cur.key, this, man);		// Notify new state of man that its entering
	}
	set=(man, next_key)=> {
		const next = this.sget(next_key);
		this.assert(next != null);	
		man.setcur(next);					// Context switch
		next.enter('set', this, man);		// Notify new state of man that its entering
	}
	sget=(key)=> key in this.#_dict ? this.#_dict[key] : null;
	assert(cond, output) { if(!cond) throw new Error("assertion failed:" + output); }

	vstate(state) { // determine if new state object has the required components
		if(!state.key) throw new Error("key not defined for state: " + state);
		if(!state.enter) state.enter = (prev,fsm,man) => {};
		if(!state.exit) state.exit = (next,fsm,man) => {};
		if(!state.setup) state.setup = (fsm,man) => {};
		if(!state.pulse) state.pulse = (fsm,man) => {};
	}
};

// relies on dependency injection in order to have a simplistic structure. This structure
// requires passing constructor functions and initialization arguments into the write_obj(...)
// func. Any object passed into this object MUST have a bind(...) member function. It will
// take an object in as an argument. Destructure it and take what you need from it.
// -DC @ 9/24/23
export class object_list {
	#_objs; #_uidh;
	constructor(uidh, nullobj) {
		this.#_uidh = uidh;
		this.#_objs = new Array();
// reserve the first slot for the null object
		this.#_uidh.reserve();
		this.#_objs.push(nullobj);
	}
	write_obj=(ctor, props)=> {
		const obj = ctor();
		const next = this.#_uidh.reserve();
// if our next index is larger, push. if not, overwrite.
		if(next >= this.#_objs.length) this.#_objs.push(obj);
		else this.#_objs[next] = obj;
// write ID
		props.id = next;
		obj.bind(props); // dependency injection
		return obj;
	}
	get_obj=(uid)=> {	
// if requested UID is zero: return null
		if(uid==0) return null;
// if the entity in question houses a zero uid, that means its dead: return null		
		const obj = this.#_objs[uid];
		if(obj == null || obj.uid() == 0) return null;
		else return obj;
	}
	rem_obj=(uid, dtor)=> {
// if attempting to remove null entity, dont!
		if(uid == 0) return;
		dtor(this.#_objs[uid]);
		this.#_uidh.open(uid);
	}
	length=()=> { return this.#_objs.length; }
	count=()=> { return this.length() - this.#_uidh.count(); }
// primarily useful to expose the list to the renderer. terrible idea btw.
	data=()=> { return this.#_objs; }
};

// simply a data class that we do not expose to the outside world.
class queue_node {
	#_prev; #_next; #_obj;
	constructor(obj) { this.#_obj = obj; }
	set_prev=(prev)=> { this.#_prev = prev; }
	set_next=(next)=> { this.#_next = next; }
	get_prev=()=> { return this.#_prev; }
	get_next=()=> { return this.#_next; }
	data=()=>{ return this.#_obj; }
}

// fairly straightforward queue implementation. read it. -DC @ 10/4/23
export class object_queue {
	#_head; #_tail; #_count;
	constructor() { this.#_count = 0; }
	head=()=>{ return this.#_head; }
	push=(obj)=> {
		if(this.#_count > 0) {
			const next = new queue_node(obj);
			next.set_prev(this.#_tail);
			this.#_tail.set_next(next);
			this.#_tail = next;
		}else {
			this.#_head = new queue_node();
			this.#_tail = new queue_node(obj);
			this.#_head.set_next(this.#_tail);
		}
		this.#_count++;
	}
	skip=(obj)=> {
		const next = new queue_node(obj);
		const hn = this.#_head.get_next();
		this.#_head.set_next(next);
		next.set_prev(this.#_head);
		next.set_next(hn);
		if(hn) hn.set_prev(next);
		this.#_count++;
	}
	pop=()=> {
		if(this.#_count > 0) {
			const hn = this.#_head.get_next();
			this.#_head = hn;
			hn.set_prev(null);
			this.#_count--;
			return hn.data();
		}else {
			return null;
		}
	}
	peek=()=> {
		if(this.#_count > 0) return this.#_head.get_next().data();
		return null;
	}
	count=()=> { return this.#_count; }
	empty=()=> { return this.#_count <= 0; }
}

// responsible for assigning UNIQUE indices to objects. Used in part with the object list. 
// -DC @ 9/24/23
export class uid_handler {
	#_list; #_top;
	constructor() {
		this.#_list = new Array();
// any index at zero is an invalid index.
		this.#_top  = 0;
	}
// get a new id.
	reserve=()=> {
		if(this.#_list.length > 0) {
			return this.#_list.pop();
		}else {
			return this.#_top++;
		}
	}
// open up a new slot to assign to.
	open=(id)=> { this.#_list.push(id); }
// reserved # of IDs
	count=()=> { return this.#_list.length; }
};

