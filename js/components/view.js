
import { v4f, q4f, m4f } from '../algebra.js';
import { gfx } from '../gfx.js';

export class c_view {
	#_entity;	  // what entity are we attached to?
	#_fov_rad;	  // field of view (in radians)
	#_near_plane; // near plane
	#_far_plane;  // far plane
	#_w_aspect; // width over height
	#_proj_type;  // perspective or orthographic projection

	#_dirty;  // whether or not our projection matrix was computed

	#_matrix; // projection matrix

	constructor(entity = null,
		w_aspect = 1.77,
		proj_type='perspective',
		fov_rad=Math.PI/2,
		near=0.1,
		far=1000) {

		this.#_entity = entity;
		this.#_fov_rad = fov_rad;
		this.#_proj_type = proj_type;

		this.#_near_plane = near;
		this.#_far_plane = far;
		this.#_w_aspect = w_aspect;

		this.#_dirty = true;
		this.#_bake();
	}

	#_bake() {
		const fov = this.#_fov_rad;
		const near = this.#_near_plane;
		const far = this.#_far_plane;
		const w_aspect = this.#_w_aspect;

		if(this.#_proj_type == 'perspective') {
			this.#_matrix = gfx.perspective(w_aspect, near, far, fov);
		}
		
		if(this.#_proj_type == 'orthographic') {
			this.#_matrix = gfx.orthographic(w_aspect, near, far);
		}
// notify upon grabbing resources that this no longer needs recomputation.
		this.#_dirty = false;
	}
// setters
	set_width_aspect(w_aspect) {
		this.#_dirty ||= (w_aspect != this.#_w_aspect);
		this.#_w_aspect = w_aspect;
	}
	set_fov_deg(fov_deg) { this.set_fov_rad(fov_deg *= Math.PI / 360); }
	set_fov_rad(fov_rad) {
		this.#_dirty ||= (fov_rad != this.#_fov_rad);
		this.#_fov_rad = fov_rad;
	}
	set_near_plane(near) {
		this.#_dirty ||= (near != this.#_near_plane);
		this.#_near_plane = near;
	}
	set_far_plane(far) {
		this.#_dirty ||= (far != this.#_far_plane);
		this.#_far_plane = far;
	}
	set_projection_type(proj) {
// perspective or orthographic are the only camera types currently
// supported.
		if(!(proj == 'perspective' || proj == 'orthographic')) {
			return;
		}

		this.#_dirty ||= (proj != this.#_proj_type);
		this.#_proj_type = proj;
	}
// getters
// compute the projection matrix if it has not been rebuilt.
	get_projection_matrix() {
		if(this.#_dirty) this.#_bake();
		return this.#_matrix;
	}
	get_projection_type() { return this.#_proj_type; }
}
