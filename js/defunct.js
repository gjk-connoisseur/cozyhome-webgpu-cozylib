	on_key_up:(self, props, event) => {
		const kc = event.keyCode;

		if(props.keys != null) {
			if(props.keys.has(kc)) {
				props.keys.delete(kc);
			}
		}else {
			props.keys = new Set();
			props.keys.add(kc);
		}
	},
	on_key_down:(self, props, event) => {
		const kc = event.keyCode;
		if(props.keys != null) {
			if(!props.keys.has(kc)) {
				props.keys.add(kc);
			}
		}else {
			props.keys = new Set();
			props.keys.add(kc);
		}
	},
