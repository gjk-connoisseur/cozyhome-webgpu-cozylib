
export class e_indexed_entity {
	#_uid; #_components;
	constructor(args) {
		const props = args.props;

		this.#_uid = args.uid;

// reflection, allows us to determine which components exist in our entity
		this['find_component'] = (type) => {
			return this.#_components.find(el => el instanceof type);
		}
		this['find_components'] = (type) => {
			return this.#_components.filter(el => el instanceof type);
		}
// getter only, nobody should have access to mutating UID.
		this['uid'] = () => { return this.#_uid; }
// callee passes a list of component functors, ctor invokes them.
		this.#_components = (props != null && props.components != null)
			? props.components.map((el) => new el(this))
			: [];
	}
}

export const create_indexed_entity = (entity_list, props={}) => {
	return entity_list.write_obj((args) => new e_indexed_entity(args), props);
}
