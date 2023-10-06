// simple dual matrix-buffer scheme for mat4x4s
// CREDITS: Daniel J. Cucuzza
// DATE: October 1st, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

import { m4f } from './algebra.js';
import { gfx } from './gfx.js';

// this object represents a particular
// verbose transformation matrix -DC @ 10/1/23
export class dual_frame {
	#_l2w_m;		#_l2w_bf;
	#_l2w_iv_m;		#_l2w_iv_bf;
	#_l2w_ivt_m;	#_l2w_ivt_bf;
	#_dirty;
	constructor(l2w = m4f.identity()) {
		this.#_l2w_m     = m4f.zero();
		this.#_l2w_iv_m  = m4f.zero();
		this.#_l2w_ivt_m = m4f.zero();

		this.set(l2w);
		this.#_dirty = true;
	}
// re-transform the mesh instance given a new worldspace matrix
	set=(l2w)=> {
		this.#_dirty ||= m4f.diff(l2w, this.#_l2w_m);

		m4f.copy(l2w, this.#_l2w_m);	   // l2w
		m4f.inverse(l2w, this.#_l2w_iv_m); // inverse
		m4f.transpose(this.#_l2w_iv_m, this.#_l2w_ivt_m); // inverse transpose
	}
	bind=(device, queue)=> {
		if(this.#_dirty) {
			if(this.#_l2w_bf != null) {
				gfx.write_gbf(queue, this.#_l2w_bf, 	this.#_l2w_m);
				gfx.write_gbf(queue, this.#_l2w_iv_bf, 	this.#_l2w_iv_m);
				gfx.write_gbf(queue, this.#_l2w_ivt_bf, this.#_l2w_ivt_m);
			}else {
				this.#_l2w_bf 	  = gfx.init_ubf(device, queue, this.#_l2w_m,     'l2w_bf');
				this.#_l2w_iv_bf  = gfx.init_ubf(device, queue, this.#_l2w_iv_m,  'l2w_iv_bf');
				this.#_l2w_ivt_bf = gfx.init_ubf(device, queue, this.#_l2w_ivt_m, 'l2w_ivt_bf');
			}
			this.#_dirty = false;
		}
	}
// call this if you want to create a bind group with these elements
	group=()=> { return { mdl_m: this.#_l2w_bf, itm_m: this.#_l2w_ivt_bf }; }
}

// stores coordinate frame information for a camera data object. No state. Purely data.
// -DC @ 9/24/23
export class dual_view {
	#_prj_m;	#_prj_bf;
	#_view_m;	#_view_bf;
	#_iview_m;	#_iview_bf;
	#_dirty;
	constructor(prj_m = m4f.identity(), view_m = m4f.identity()) {
		this.#_prj_m   = m4f.zero(); // projection matrix
		this.#_view_m  = m4f.zero(); // view matrix (l2w)
		this.#_iview_m = m4f.zero(); // inverse view matrix

// set up view and projection matrices
		this.set_projection(prj_m);
		this.set_view(view_m);

		this.#_dirty = true;
	}
	get_view=()=> { return this.#_view_m; }
	set_view=(view_m)=> { 
		this.#_dirty |= m4f.diff(view_m, this.#_view_m);

		m4f.copy(view_m, this.#_view_m);
		m4f.inverse(view_m, this.#_iview_m);
	}
	set_projection=(prj_m)=> { 
		this.#_dirty |= m4f.diff(prj_m, this.#_prj_m);

		m4f.copy(prj_m, this.#_prj_m);
	}
	bind=(device, queue)=> {
		if(this.#_dirty) {
			if(this.#_prj_bf != null) {
				gfx.write_gbf(queue, this.#_prj_bf,   this.#_prj_m);
				gfx.write_gbf(queue, this.#_view_bf,  this.#_view_m);
				gfx.write_gbf(queue, this.#_iview_bf, this.#_iview_m);
			}else {
				this.#_prj_bf   = gfx.init_ubf(device, queue, this.#_prj_m,   'prj_bf');
				this.#_view_bf  = gfx.init_ubf(device, queue, this.#_view_m,  'view_bf');
				this.#_iview_bf = gfx.init_ubf(device, queue, this.#_iview_m, 'iview_bf');
			}

			this.#_dirty = false;
		}
	}
// call this if you want to create a bind group with these elements
	group=()=> { return { prj_m: this.#_prj_bf, ivw_m: this.#_iview_bf }; }
}
