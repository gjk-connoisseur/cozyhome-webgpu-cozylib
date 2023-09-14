// lightweight redone meshing module
// CREDITS: Daniel J. Cucuzza
// DATE: September 13th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

import { v4f } from './algebra.js';

export const primitives = {
	cube:()=> {
		const at = (i, v) => {
			v[2] = ~~(i/4);
			v[1] = ~~((i - 4*v[2]) / 2);
			v[0] = ~~((i - 4*v[2]) % 2);

			v[0] = -0.5 + v[0];
			v[1] = -0.5 + v[1];
			v[2] = -0.5 + v[2];

			return v;
		}

		const cycle = (i,j=0) => {
			i %= 4;
			return 4*j + i + ~~((i+1)/3) * (1 - 2*~~((i+1)/4));
		}

		const v_size = 6;
		const v_buffer = new Float32Array(v_size * 24);

		let vec = v4f.vec();

		const add_vert=(i,j=0)=> {
			vec = at(i, vec);
			for(let k = 0;k<3;k++) {
				v_buffer[k + v_size*j] = vec[k];
			}
		}

		const add_normals=(nv)=> {
			const vi = nv*v_size;
			const ix = v_buffer[vi + v_size	   ] 	- v_buffer[vi];
			const iy = v_buffer[vi + v_size + 1] 	- v_buffer[vi+1];
			const iz = v_buffer[vi + v_size + 2] 	- v_buffer[vi+2];

			const jx = v_buffer[vi + 3*v_size	 ] 	- v_buffer[vi + v_size];
			const jy = v_buffer[vi + 3*v_size + 1] 	- v_buffer[vi + v_size + 1];
			const jz = v_buffer[vi + 3*v_size + 2] 	- v_buffer[vi + v_size + 2];
	
			v_buffer[vi + 3] = iy*jz - iz*jy;
			v_buffer[vi + 4] = iz*jx - ix*jz;
			v_buffer[vi + 5] = ix*jy - iy*jx;
		}
	
// load vertices
		let nv = 0;
		for(let i=0;i<4;i++) {
			for(let j=0;j<4;j++) {
				let jx = (j%2);
				let jy = ~~(j/2);
				add_vert(cycle(i+jx,jy), nv++);
			}

// generate normal:
			add_normals(nv-4);
		}

		for(let j=0;j<2;j++) {
			for(let i=0;i<4;i++) {
				add_vert(i + 4*j, nv++);
			}
			add_normals(nv-4);
		}

		const t_buffer = new Uint16Array(36);
		let nt = 0;
// load triangles
		for(let i=0;i<6;i++) {
			const ti = 4*i;
			for(let j=0;j<2;j++) {
				t_buffer[nt++] = ti+j;
				t_buffer[nt++] = ti+j+1;
				t_buffer[nt++] = ti+j+2;
			}
		}
		return { v_buffer, t_buffer };
	}
};
