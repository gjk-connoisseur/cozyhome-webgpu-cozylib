// copy image data buffer to cpu
//		await props.gbuffer.mapAsync(GPUMapMode.READ, 0,
//			 4*props.texture.width*props.texture.height
//		);
//		const buffer = props.gbuffer.getMappedRange();

//		props.gbuffer = device.createBuffer({ 
//			size: 4*props.texture.width*props.texture.height,
//			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
//		});
