// lightweight redone meshing module
// CREDITS: Daniel J. Cucuzza
// DATE: September 13th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

import { v4f } from './algebra.js';

export const primitives = {
// no i/o required. very sloppy but returns vertex buffers and elements
	cube:()=> {
		let vec = v4f.vec();
		const at = (i, v) => {
			v[2] = ~~(i/4);
			v[1] = ~~((i - 4*v[2]) / 2);
			v[0] = ~~((i - 4*v[2]) % 2);
			for(let i=0;i<3;i++) v[i] = -0.5 + v[i];
			return v;
		}
		const cycle = (i,j=0) => {
			i %= 4;
			return 4*j + i + ~~((i+1)/3) * (1 - 2*~~((i+1)/4));
		}
		const v_size = 3;
		const p_buffer = new Float32Array(v_size * 24);
		const n_buffer = new Float32Array(v_size * 24);
		const add_vert=(i,j=0)=> {
			vec = at(i, vec);
			for(let k = 0;k<3;k++) {
				p_buffer[k + v_size*j] = vec[k];
			}
		}
		const add_normals=(nv, sign=1)=> {
			const vi = nv*v_size;

			const ix = p_buffer[vi + v_size	   ] 	- p_buffer[vi];
			const iy = p_buffer[vi + v_size + 1] 	- p_buffer[vi+1];
			const iz = p_buffer[vi + v_size + 2] 	- p_buffer[vi+2];

			const jx = p_buffer[vi + 3*v_size	 ] 	- p_buffer[vi + v_size];
			const jy = p_buffer[vi + 3*v_size + 1] 	- p_buffer[vi + v_size + 1];
			const jz = p_buffer[vi + 3*v_size + 2] 	- p_buffer[vi + v_size + 2];

			n_buffer[vi	   ] = sign*(iy*jz - iz*jy);
			n_buffer[vi + 1] = sign*(iz*jx - ix*jz);
			n_buffer[vi + 2] = sign*(ix*jy - iy*jx);

			for(let i=1;i<4;i++) {
				n_buffer[v_size*i + vi	  ] = n_buffer[vi];
				n_buffer[v_size*i + vi + 1] = n_buffer[vi + 1];
				n_buffer[v_size*i + vi + 2] = n_buffer[vi + 2];
			}
		}
// load wall vertices
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
// load cap vertices
		for(let j=0;j<2;j++) {
			for(let i=0;i<4;i++) {
				add_vert(i+4*j, nv++); 
			}
			add_normals(nv-4, -1 + 2*~~((j+1)/2));
		}
// load triangles
		const t_buffer = new Uint16Array(36);
		for(let nt=0,i=0;i<6;i++) {
			const ti = 4*i;
			for(let j=0;j<2;j++) {
				for(let k=0;k<3;k++) {
					t_buffer[nt++] = ti+j+k;
				}
			}
		}
		return { p_buffer, n_buffer, t_buffer };
	}
};
