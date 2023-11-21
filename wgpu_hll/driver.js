
import { bootstrap_engine } from './pulse.js';
import { io } from './io.js';

const scene = {
	center_view:(self, props)=> {
		const center_view = document.getElementById("center_view");
		const canvas_wgpu = props.wgpu.ctx.canvas;

		if(center_view) { center_view.appendChild(canvas_wgpu); }

// tells the underlying i/o callbacks to focus on the main window.
		props.overwrite_input_window(window);
	},
	load: async(self, props) => {
		props.wgpu = await props.create_web_gpu_canvas(640,480,"WEBGPU_CANVAS");
	},
	start: async(self, props) => {
		self.center_view(self, props);

		io.load_text('./pure.rs', (response) => {
			const blocks = rust_reader.read_rust(response);
			blocks.forEach((block) => console.log(block));
		});
	},
};

window.addEventListener('load', () => { bootstrap_engine(scene) });

const rust_reader = {
	read_rust:(text)=> {
		const block_headers = ['struct', 'fn'];

// eliminate one-line c-style comments (order matters here!)
		const raw = text.replace(/\/\/.*$\n/gm, "") // remove C-style comments
			.replace(/[\(,:;\)\{\}]/g, (match) => ` ${match} `) // space out separators.
			.replace(/\n/g, "") 	// remove newlines! (fucks up display)
			.replace(/\ +/g, " ")	// remove excessive whitespace
		;
// store the position of where each existential symbol is located in the chain of 
// tokens. We'll then begin to tokenize everything.
		const block_roots = [];

// tokenize your input
		const tokens = raw.split(/\ /g);

// search for existential keywords. These will be tree roots.
		tokens.forEach((token, index)=> {
			if(block_headers.includes(token)) {
				block_roots.push({ index, token });
			}
		});

// chronological ordering of code tokenization
		block_roots.sort((a,b)=> { a.index >= b.index });

// keeps track of { } patterns and determines at what index the tokenization string
// ends a procedure.
		const find_block_stem = (block, _in='{', _out='}') => {
			let c_blocks = 0; // # of nested blocks discovered

// think of this as the convex interval storing all tokens and nested tokens
// for this code block -DC @ 11/20/23
			let begin = -1, end = -1;
// loop through all tokens in the strip
			for(let index = block.index; index < tokens.length; index++) {
				let n_blocks = c_blocks;
				const symbol = tokens[index];

				if(symbol.includes(_in)) {
// determine the first {
					if(n_blocks == 0) {
						begin = index;
					}
					n_blocks++;
				}else if(symbol.includes(_out)) {
					n_blocks--;
// determine the last }
					if(c_blocks != n_blocks && n_blocks == 0) {
						end = index;
						break;
					}
				}
// Going from a higher match count to a lower match count with at least
// one recognized '{' gives us a valid exit. -DC @ 11/19/23
				c_blocks = n_blocks;
			}
			return { begin, end };
		}

// a map of functions that handle how to process blocks of the type:
// { symbol, type, code }
		const block_classifier = {
// in the event our block is a function
			_fn: (root) => {
				const header = tokens.slice(root.index + 1, root.bounds.begin);

				const arrow_index = header.findIndex((token) => token === '->');

				const trim_symbols = ['(',')'];
// function has a return type
				if(arrow_index >= 0) {
// remove the encapsulating parenthesis from both the input and output tuples
					const input_tokens = header.slice(1, arrow_index)
						.filter((el) => !trim_symbols.includes(el));

					const output_tokens = header.slice(arrow_index + 1, header.length);
//						.filter((el) => !trim_symbols.includes(el));

// trim excessive whitespace
					input_tokens.forEach((el) => el.trim());
					output_tokens.forEach((el) => el.trim());

					root.input = input_tokens.map((token, index) => {
						if(token === ':') {
							return { symbol: input_tokens[index-1], type: input_tokens[index+1] };
						}
						return undefined;
					}).filter(el => el !== undefined);

					root.output = output_tokens.join(' ').split(',')
						.map(el => el.trim()); // remove whitespace
				}else {
// handling void return funcs
					root.output = '';

					const input_tokens = header.filter((el) => !trim_symbols.includes(el));

					root.input = input_tokens.map((token, index) => {
						if(token === ':') {
							return { symbol: input_tokens[index-1], type: input_tokens[index+1] };
						}
						return undefined;
					}).filter(el => el !== undefined);
				}
				root.bake = () => {
					const is_void = root.output === '';
					const raw_input = (root.input !== undefined)
						? root.input.map((m)=> `${m.symbol} : ${m.type}`).join(', ')
						: '';
					const raw_output = (root.output !== '')
						? `-> ${root.output.join(', ')}`
						: '';

					return `${root.type} ${root.symbol} (${raw_input}) ${raw_output} { ${root.tokens.join(' ')} }`;
				}

				delete root.bounds;
				delete root.index;
			},
// in the event our block is a structure
			_struct: (root) => {
				const raw = root.tokens.join(' ');
				const tuples = raw.split(',');

// build a list of symbol type pairs
				root.members = tuples.map((tuple) => {
					const tokens = tuple.split(':');
					return { symbol: tokens[0].trim(), type: tokens[1].trim() };
				});

				root.bake = () => {
// turn our members back into string soup.
					const raw_members = root.members.map((m)=> `${m.symbol}:${m.type}`).join();
					return `${root.type} ${root.symbol} \{ ${raw_members} \}`;
				};

// once we are finished we will delete our token chain: they were mapped to members.
				delete root.tokens;
				delete root.bounds;
				delete root.index;
			}
		}

// store each chunk of code as copies of the tokenized map. We are 
// not going to handle index bounds for all blocks.
		block_roots.forEach((root) => {
			const bounds = find_block_stem(root);

			root.bounds = bounds;
// this sub-interval does not contain the outer block tokens { }
			root.tokens = tokens.slice(bounds.begin + 1, bounds.end); // sub tokens
			root.type = tokens[root.index]; // fn or struct
			root.symbol = tokens[root.index + 1]; // name of type
		});

// further processing depending on the type of block we are dealing
// with:
		block_roots.forEach(root => block_classifier[`_${root.type}`](root));

		return block_roots;
	}
}
