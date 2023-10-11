import { v4f, q4f, m4f } from '../algebra.js';

// if you want to move in world space, you should know the cost
// of doing so. I am not implementing a world space computation.
// you can do that yourself. This is to make your hierarchy operations 
// much more visible. As well as this, I suggest keeping the depth
// of your hierarchy as small as possible. -DC @ 10/9/23

// represents an arbitrary transformation matrix
// that will be stored inside of a component object in
// an entity
export class c_transform {
	#_entity;	// what is the entity this component is attached to? (immutable)
	#_parent;	// our owner in the tree hierarchy
	#_children; // our children in the tree hierarchy

	#_shift; // v4 -> offset
	#_twist; // q4 -> rotation
	#_scale; // v4 -> dilation
	
	#_dirty; // whether or not our matrix has been computed.

	#_matrix; // 4x4<f32> matrix coordinate frame

	constructor (entity = null,
		children = [],
		shift = v4f.vec(0,0,0,1),
		twist = q4f.identity(),
		scale = v4f.vec(0,0,0,1)) {

		this.#_entity = entity;
		this.#_children = children;
		this.#_parent = null;

		this.#_shift = shift;
		this.#_twist = twist;
		this.#_scale = scale;

		this.#_dirty = true;

		this.#_bake();
	}
// used in the process of changing parents
	#_remove_child(child) {
		this.#_children = this.#_children.filter(el => el != child);
	}
	#_append_child(child) {
// used in preventing duplicates
		this.#_children = this.#_children.filter(el => el != child);
		this.#_children.push(child);
	}
// converts its arguments into a 4x4:
	#_bake() {
		this.#_matrix = m4f.stack(m4f.shift(this.#_shift),
			  q4f.to_m4f(this.#_twist),
			  m4f.diag(this.#_scale)
		);
		this.#_dirty = false;
	}
// setters
	set_shift(v=v4f.zero()) {
		this.#_dirty = v4f.diff(v, this.#_shift);
		v4f.copy(v, this.#_shift);
	}
	set_twist(q=q4f.identity()) {
		this.#_dirty = q4f.diff(q, this.#_twist);
		q4f.copy(q, this.#_twist);
	}
	set_scale(v=v4f.vec(1,1,1,1)) {
		this.#_dirty = v4f.diff(v, this.#_scale);
		v4f.copy(v, this.#_scale);
	}
	set_parent(parent) {
// tell parent to remove us
		if(this.#_parent != null) {
			this.#_parent.#_remove_child(this);
		}
// reassign parent pointer
		this.#_parent = parent;
	}
// getters
	get_parent() { return this.#_parent; }
	get_child_count() { return this.#_children.length; }
	get_child(i) { return this.#_children[i]; }

	get_shift(v=v4f.zero()) { return v4f.copy(this.#_shift, v); }
	get_twist(q=q4f.identity()) { return q4f.copy(this.#_twist, q); }
	get_scale(v=v4f.vec(1,1,1,1)) { return v4f.copy(this.#_scale, v); }

// bakes local transformation information in the event
// a descendant or ancestor accesses the transformation:
	get_local_matrix() {
		if(this.#_dirty) this.#_bake();
		return this.#_matrix;
	}
}
