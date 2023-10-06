// lightweight redone algebraic structures module
// CREDITS: Daniel J. Cucuzza
// DATE: September 8th, 2023

// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

// projective 2-vectors used for affine mappings in R^2.
export const v3f = {
	vec:(x=0,y=0,z=0)=>{
		const buf = new Float32Array(3);
		v3f.set(buf,x,y,z);
		return buf;
	},
	copy:(a,b)=> { for(let i=0;i<3;i++) b[i] = a[i]; return b; },
	set:(v,x=0,y=0,z=0)=> { v[0] = x; v[1] = y; v[2] = z; },
	add:(v,w,q = v3f.vec(0,0,1))=> { for(let i=0;i<3;i++) q[i] = v[i] + w[i]; return q; },
	sub:(v,w,q = v3f.vec(0,0,1))=> { for(let i=0;i<3;i++) q[i] = v[i] - w[i]; return q; },
	mul:(c,v,q = v3f.vec(0,0,1))=> { for(let i=0;i<3;i++) q[i] = c*v[i]; return q; },
	dot:(v,w)  => v[0]*w[0] + v[1]*w[1] + v[2]*w[2],
	norm:(v)   => Math.sqrt(v3f.dot(v,v)),
	blade:(v,w) => v[0]*w[1] - v[1]*w[0], // attitude + orientation
	orient:(v,w,eps=1e-6) => {
		const at = v3f.blade(v,w);
		return (at >= -eps && at <= eps) ? 0 : Math.sign(at);
	},
	perp:(v,q)=> {
		q[0] = -v[1]; q[1] = v[0];
		return q;
	},
	unit:(v,q)=> {
		const n = v3f.norm(v);
		for(let i=0;i<3;i++) { q[i] = v[i] / n; }
		return q;
	},
	lerp:(v,w,q,t=0)=> {
		for(let i=0;i<3;i++) { q[i] = (1-t)*v[i] + t*w[i]; }
		return q;
	},
	onto:(v,w,q)=> {
		const ww = v3f.dot(w,w);
		if(ww < 0.0001) for(let i=0;i<3;i++) q[i] = w[i];
		const vw = v3f.dot(v,w);
		v3f.mul(vw/ww, w, q);
		return q;
	},
};

export const m3f = {
	zero:()=>new Float32Array(9),
	clear:(a)=> { for(let i=0;i<9;i++) a[i] = 0; },
	copy:(a,b)=> { for(let i=0;i<9;i++) b[i] = a[i]; return b; },
	diag:(e=1, q=m3f.zero())=> {
		const buf = m3f.zero();
		for(let i=0,j=0;i<9;i+=3,j++) buf[i+j] = e;
		return buf;
	},
	identity:()=> m3f.diag(),
	transpose:(a,b=m3f.zero())=> {
		for(let i=0;i<3;i++) {
			for(let j=0;j<3;j++) {
				b[3*i+j] = a[3*j + i];
			}
		}
		return b;
	},
	multiply:(a,b,c=m3f.zero())=> { // multiply b by a
		c[0] = a[0]*b[0] + a[3]*b[1] + a[6]*b[2];
		c[1] = a[1]*b[0] + a[4]*b[1] + a[7]*b[2];
		c[2] = a[2]*b[0] + a[5]*b[1] + a[8]*b[2];

		c[3] = a[0]*b[3] + a[3]*b[4] + a[6]*b[5];
		c[4] = a[1]*b[3] + a[4]*b[4] + a[7]*b[5];
		c[5] = a[2]*b[3] + a[5]*b[4] + a[8]*b[5];

		c[6] = a[0]*b[6] + a[3]*b[7] + a[6]*b[8];
		c[7] = a[1]*b[6] + a[4]*b[7] + a[7]*b[8];
		c[8] = a[2]*b[6] + a[5]*b[7] + a[8]*b[8];
		return c;
	},
	inverse:(a,b,eps=1e-4)=> {
// cofactor expansion of 3x3
		b[0] = (a[4]*a[8] - a[7]*a[5]); // ei_fh
		b[1] = (a[2]*a[7] - a[1]*a[8]); // gf_di
		b[2] = (a[1]*a[5] - a[4]*a[2]); // dh_eg

		b[3] = (a[6]*a[5] - a[3]*a[8]); // ch_bi
		b[4] = (a[0]*a[8] - a[6]*a[2]); // ai_cg
		b[5] = (a[3]*a[2] - a[0]*a[5]); // bg_ah

		b[6] = (a[3]*a[7] - a[4]*a[6]); // bf_ec
		b[7] = (a[6]*a[1] - a[0]*a[7]); // cd_af
		b[8] = (a[0]*a[4] - a[3]*a[1]); // ae_bd
// determinant of 3x3 matrix
		const det = a[0]*b[0] + a[3]*b[1] + a[6]*b[2];
// avoid division by zero
		if(det > eps || det < -eps) {
			for(let i=0;i<b.length;i++) b[i] /= det;
		}else {
			console.log("determinant of " + a + " is zero.");
			b.clear();
		}
		return b;
	},
	map:(a,x)=> {
		x.set(
			a[0]*x[0] + a[3]*x[1] + a[6]*x[2],
			a[1]*x[0] + a[4]*x[1] + a[7]*x[2],
			a[2]*x[0] + a[5]*x[1] + a[8]*x[3]
		);	
		return x;
	},
	amap:(a,x)=> {
		const abs = (y) => y > 0 ? y : -y;
		x.set(
			-a[0]*x[0] - a[3]*x[1] + a[6]*x[2],
			-a[1]*x[0] - a[4]*x[1] + a[7]*x[2],
			-a[2]*x[0] - a[5]*x[1] + a[8]*x[3]
		);	
		return x;
	},
// 3x3 rotation matrix
	rot:(theta=0, a=m3f.zero())=> {
		theta *= Math.PI / 180;
		const ct = Math.cos(theta);
		const st = Math.sin(theta);
		m3f.clear(a);
		a[0] = +ct; a[3] = -st;
		a[1] = +st; a[4] = +ct;
		a[8] = 1;
		return a;
	},
// 3x3 translation matrix
	shift:(x=v3f.zero(),a=m3f.identity())=> {
		a[6] = x[0]; a[7] = x[1]; a[8] = x[2];
		return a;
	},
// last matrix element will be the one written to:
	stack:(...mats)=> {
		const n = mats.length;
		const mul_rec=(a,b)=> {
 // half index distance
			const hid = ~~((b-a) / 2);
			return b-a > 1
				? m3f.multiply(mul_rec(a,a+hid), mul_rec(a+hid, b))
				: mats[a];
		}
		return mul_rec(0, n);
	}
}

// projective 3-vectors used for affine maps in R^3.
export const v4f = {
	vec:(x=0,y=0,z=0,w=1)=>{
		const buf = new Float32Array(4);
		v4f.set(buf,x,y,z,w);
		return buf;
	},
	copy:(a,b)=> { for(let i=0;i<4;i++) b[i] = a[i]; return b; },
	set:(v,x=0,y=0,z=0,w=0)=> { v[0] = x; v[1] = y; v[2] = z; v[3] = w; },
	add:(v,w,q = v4f.vec(0,0,0,0))=> { for(let i=0;i<4;i++) q[i] = v[i] + w[i]; return q; },
	sub:(v,w,q = v4f.vec(0,0,0,0))=> { for(let i=0;i<4;i++) q[i] = v[i] - w[i]; return q; },
	mul:(c,v,q = v4f.vec(0,0,0,0))=> { for(let i=0;i<4;i++) q[i] = c*v[i]; return q; },
	dot:(v,w)  => v[0]*w[0] + v[1]*w[1] + v[2]*w[2] + v[3]*w[3],
	norm:(v)   => Math.sqrt(v4f.dot(v,v)),
	cross:(v,w,q)=> {
		q[0] = v[1]*w[2] - v[2]*w[1];
		q[1] = v[2]*w[0] - v[0]*w[2];
		q[2] = v[0]*w[1] - v[1]*w[0];
		return q;
	},
	unit:(v,q)=> {
		const n = v4f.norm(v);
		if(n >= 0.0001) {
			for(let i=0;i<4;i++) { q[i] = v[i] / n; }
		}else {
			for(let i=0;i<4;i++) { q[i] = v[i] }
		}
		return q;
	},
	lerp:(v,w,q,t=0)=> {
		for(let i=0;i<4;i++) { q[i] = (1-t)*v[i] + t*w[i]; }
		return q;
	},
	onto:(v,w,q)=> {
		const ww = v4f.dot(w,w);
		if(ww < 0.0001) for(let i=0;i<4;i++) q[i] = w[i];
		const vw = v4f.dot(v,w);
		v4f.mul(vw/ww, w, q);
		return q;
	}
}

// matrix 4x4
export const m4f = {
	zero:()=>new Float32Array(16),
	clear:(a)=> { for(let i=0;i<16;i++) a[i] = 0; },
	copy:(a,b)=> { for(let i=0;i<16;i++) b[i] = a[i]; return b; },
	diag:(e=v4f.vec(1,1,1,1), q=m4f.zero())=> {
		const buf = m4f.zero();
		for(let i=0,j=0;i<16;i+=4,j++) buf[i+j] = e[j];
		return buf;
	},
	diff:(a,b, eps=0.0001)=> {
		let i = 0;
		for(;i<16;i++) {
			const dx = a[i] - b[i];
			if(dx < eps || dx > -eps) break;
		}
		return i < 16;
	},
	identity:()=> m4f.diag(),
	multiply:(a,b,c=m4f.zero())=> {
		for(let i=0;i<16;i++) {
			c[i] =  a[i&3     ] * b[i&12	] +
					a[i&3 |  4] * b[i&12 | 1] +
					a[i&3 |  8] * b[i&12 | 2] + 
					a[i&3 | 12] * b[i&12 | 3];
		}
		return c;
	},
// credit goes to ken perlin here for his nifty cofactor expansion bitshifts :) -DC @ 8/28/23
	inverse:(a,b=m4f.zero())=> {
		let det = 0;
		const cofactor = (c, r) => {
 			const s = (i, j) => a[c+i & 3 | (r+j & 3) << 2];
 			return (c+r & 1 ? -1 : 1) * ( (s(1,1) * (s(2,2) * s(3,3) - s(3,2) * s(2,3)))
 				- (s(2,1) * (s(1,2) * s(3,3) - s(3,2) * s(1,3)))
 				+ (s(3,1) * (s(1,2) * s(2,3) - s(2,2) * s(1,3))) );
 		}
		for (let i=0; i<16;  i++) b[i] = (cofactor(i >> 2, i & 3));
		for (let i=0; i<4;   i++) det += a[i] * b[i << 2];
		for (let i=0; i<16;  i++) b[i] /= det;
		return b;
	},
	transpose:(a,b=m4f.zero())=> {
		if(b != null) {
			for(let i=0;i<4;i++) {
				for(let j=0;j<4;j++) {
					b[4*i+j] = a[4*j + i];
				}
			}
			return b;
		}else {
// in-place transpose
			for(let i=0;i<4;i++) {
				for(let j=i+1;j<4;j++) {
					const o = a[4*i + j];
					a[4*i + j] = a[4*j + i];
					a[4*j + i] = o;
				}
			}
			return a;
		}
	},
	rotx:(t, a = m4f.identity())=> {
		const ct = Math.cos(t), st = Math.sin(t);
		m4f.clear(a);
		a[5] = +ct; a[ 6] = +st;
		a[9] = -st; a[10] = +ct;
		a[0] = 1;   a[15] = 1;
		return a;
	},
	roty:(t, a=m4f.identity())=> {
		const ct = Math.cos(t), st = Math.sin(t);
		m4f.clear(a);
		a[0] = +ct; a[ 2] = -st;
		a[8] = +st; a[10] = +ct;
		a[5] = 1;	a[15] = 1;
		return a;
	},
	rotz:(t, a=m4f.identity())=> {	
		const ct = Math.cos(t), st = Math.sin(t);
		m4f.clear(a);
		a[0]  = +ct; a[ 1] = +st;
		a[4]  = -st; a[ 5] = +ct;
		a[10] = 1; 	 a[15] = 1;
		return a;
	},
	uscale:(e=1, a=m4f.zero()) => {
		a = m4f.diag(v4f.vec(e,e,e,e), a); a[15] = 1;
		return a;
	},
// non-uniform scale
	scale:(e=v4f.vec(1,1,1,1), a=m4f.zero())=> {
		a = m4f.diag(e, a); a[15] = 1;
		return a;
	},
// 4x4 translation matrix
	shift:(x=v4f.zero(),a=m4f.identity())=> {
		a[12] = x[0]; a[13] = x[1]; a[14] = x[2]; a[15] = x[3];
		return a;
	},
	map:(a,x)=> {
		v4f.set(x,
			a[0]*x[0] + a[4]*x[1] + a[ 8]*x[2] + a[12]*x[3],
			a[1]*x[0] + a[5]*x[1] + a[ 9]*x[2] + a[13]*x[3],
			a[2]*x[0] + a[6]*x[1] + a[10]*x[2] + a[14]*x[3],
			a[3]*x[0] + a[7]*x[1] + a[11]*x[2] + a[15]*x[3],
		);	
		return x;
	},
	amap:(a,x)=> {
		const abs = (y) => y > 0 ? y : -y;
		v4f.set(x,
			-abs(a[0])*x[0] - abs(a[4])*x[1] - abs(a[ 8])*x[2] + abs(a[12])*x[3],
			-abs(a[1])*x[0] - abs(a[5])*x[1] - abs(a[ 9])*x[2] + abs(a[13])*x[3],
			-abs(a[2])*x[0] - abs(a[6])*x[1] - abs(a[10])*x[2] + abs(a[14])*x[3],
			-abs(a[3])*x[0] - abs(a[7])*x[1] - abs(a[11])*x[2] + abs(a[15])*x[3],
		);	
		return x;
	},
// last matrix element will be the one written to:
	stack:(...mats)=> {
		const n = mats.length;
		const mul_rec=(a,b)=> {
 // half index distance
			const hid = ~~((b-a) / 2);
			return b-a > 1
				? m4f.multiply(mul_rec(a,a+hid), mul_rec(a+hid, b))
				: mats[a];
		}
		return mul_rec(0, n);
	}
}

// versors
export const q4f = {
	zero:()=>new Float32Array(4),
	vec:(x=0,y=0,z=0,w=1)=>{
		const buf = new Float32Array(4);
		q4f.set(buf,x,y,z,w);
		return buf;
	},
	copy:(a,b)=> { for(let i=0;i<4;i++) b[i] = a[i]; return b; },
	set:(v,x=0,y=0,z=0,w=0)=> { v[0] = x; v[1] = y; v[2] = z; v[3] = w; },
	clear:(a)=> { for(let i=0;i<4;i++) a[i] = 0; },
	dot:(v,w)=> v[0]*w[0] + v[1]*w[1] + v[2]*w[2] + v[3]*w[3],
	norm:(v)=> Math.sqrt(q4f.dot(v,v)),
	unit:(v,q)=> {
		const n = q4f.norm(v);
		for(let i=0;i<4;i++) { q[i] = v[i] / n; }
		return q;
	},
	identity:(e=1)=> {
		const q = m4f.zero();
		q[3] = 1;
		return q;
	},
	multiply:(v,w,q=q4f.identity())=> {
// https://en.wikipedia.org/wiki/Quaternion#Multiplication_of_basis_elements
		q[0] = v[3]*w[0] + v[0]*w[3] + v[1]*w[2] - v[2]*w[1];
		q[1] = v[3]*w[1] + v[1]*w[3] + v[2]*w[0] - v[0]*w[2];
		q[2] = v[3]*w[2] + v[2]*w[3] + v[0]*w[1] - v[1]*w[0];
		q[3] = v[3]*w[3] - v[0]*w[0] - v[1]*w[1] - v[2]*w[2];
		return q;
	},
	inverse:(v,q)=> {
		const qdot = v4f.dot(v,v);
		for(let i=0;i<3;i++) { q[i] = -v[i] / qdot; }
		q[3] = v[3] / qdot;
		return q;
	},
	conjugate:(v,q)=> {
		for(let i=1;i<4;i++) q[i] = -v[i];
		return q;
	},	
	axis_angle:(axis = v4f.vec(0,1,0), angle=0, q=q4f.identity())=> {
		axis = v4f.unit(axis, axis);

		const half = angle / 2;
		const sh = Math.sin(half);
		const ch = Math.cos(half);
		for(let i=0;i<3;i++) { q[i] = axis[i]*sh; }
		q[3] = ch;
		return q;
	},
	to_m4f:(v,q=m4f.identity())=> {
		q4f.unit(v,v);

		m4f.clear(q);
		q[0]  = 1 - 2*v[1]*v[1] - 2*v[2]*v[2];
		q[1]  =     2*v[0]*v[1] + 2*v[3]*v[2];
		q[2]  =     2*v[0]*v[2] - 2*v[3]*v[1];

		q[4]  = 	2*v[0]*v[1] - 2*v[3]*v[2];
		q[5]  = 1 - 2*v[0]*v[0] - 2*v[2]*v[2];
		q[6]  =     2*v[1]*v[2] + 2*v[3]*v[0];
		
		q[8]  =     2*v[0]*v[2] + 2*v[3]*v[1];
		q[9]  =     2*v[1]*v[2] - 2*v[3]*v[0];
		q[10] =	1 - 2*v[0]*v[0] - 2*v[1]*v[1];
		q[15] = 1;
		return q;
	}
}
