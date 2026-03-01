class RopeManager {
    constructor(player) {
        this.player = player;
        this.state = 'idle'; // idle, hasRope, ropeActive
    }

    // Implement the core state machine
    setState(newState) {
        console.log(`RopeManager state changing from ${this.state} to ${newState}`);
        this.state = newState;
    }

    acquireRope() {
        this.setState('hasRope');
    }

    deploy(target) {
        if (this.state !== 'hasRope') {
            console.error('Cannot deploy rope without having a rope');
            return;
        }

        this.setState('ropeActive');

        const distance = Math.sqrt(Math.pow(this.player.x - target.x, 2) + Math.pow(this.player.y - target.y, 2));

        if (distance > target.maxRopeDistance) {
            console.error('Target is out of range');
            this.setState('hasRope');
            return;
        }

        if (target.type === 'lever') {
            target.toggle();
        } else if (target.type === 'button') {
            target.press();
        }

        this.setState('idle');
    }
}
