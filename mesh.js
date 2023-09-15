// lightweight redone meshing module
// CREDITS: Daniel J. Cucuzza
// DATE: September 13th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

import { v4f } from './algebra.js';

export const primitives = {
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

		const v_size = 6;
		const v_buffer = new Float32Array(v_size * 24);

		const add_vert=(i,j=0)=> {
			vec = at(i, vec);
			for(let k = 0;k<3;k++) {
				v_buffer[k + v_size*j] = vec[k];
			}
		}
		const add_normals=(nv, sign=1)=> {
			const vi = nv*v_size;

			const ix = v_buffer[vi + v_size	   ] 	- v_buffer[vi];
			const iy = v_buffer[vi + v_size + 1] 	- v_buffer[vi+1];
			const iz = v_buffer[vi + v_size + 2] 	- v_buffer[vi+2];

			const jx = v_buffer[vi + 3*v_size	 ] 	- v_buffer[vi + v_size];
			const jy = v_buffer[vi + 3*v_size + 1] 	- v_buffer[vi + v_size + 1];
			const jz = v_buffer[vi + 3*v_size + 2] 	- v_buffer[vi + v_size + 2];

			v_buffer[vi + 3] = sign*(iy*jz - iz*jy);
			v_buffer[vi + 4] = sign*(iz*jx - ix*jz);
			v_buffer[vi + 5] = sign*(ix*jy - iy*jx);

			for(let i=1;i<4;i++) {
				v_buffer[v_size*i + vi + 3] = v_buffer[vi + 3];
				v_buffer[v_size*i + vi + 4] = v_buffer[vi + 4];
				v_buffer[v_size*i + vi + 5] = v_buffer[vi + 5];
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
		return { v_buffer, t_buffer };
	}
};
