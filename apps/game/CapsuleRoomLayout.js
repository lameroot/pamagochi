
// You can write more code here

/* START OF COMPILED CODE */

class CapsuleRoomLayout extends Phaser.Scene {

	constructor() {
		super("CapsuleRoomLayout");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// capsuleRoomBackground
		const capsuleRoomBackground = this.add.image(640, 360, "capsule-room");

		// capsuleRoomForeground
		const capsuleRoomForeground = this.add.image(640, 360, "capsule-room-foreground");

		// pamagochiPreview
		const pamagochiPreview = this.add.image(642, 545, "pamagochi-idle");
		pamagochiPreview.setOrigin(0.5, 0.86);

		// eggPreview
		const eggPreview = this.add.image(525, 565, "pamagochi-egg");
		eggPreview.scaleX = 0.45;
		eggPreview.scaleY = 0.45;
		eggPreview.setOrigin(0.5, 0.86);

		this.capsuleRoomBackground = capsuleRoomBackground;
		this.capsuleRoomForeground = capsuleRoomForeground;
		this.pamagochiPreview = pamagochiPreview;
		this.eggPreview = eggPreview;

		this.events.emit("scene-awake");
	}

	/** @type {Phaser.GameObjects.Image} */
	capsuleRoomBackground;
	/** @type {Phaser.GameObjects.Image} */
	capsuleRoomForeground;
	/** @type {Phaser.GameObjects.Image} */
	pamagochiPreview;
	/** @type {Phaser.GameObjects.Image} */
	eggPreview;

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
