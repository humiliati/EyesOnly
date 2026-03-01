class Lever {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.type = 'lever';
        this.name = 'Lever';
        this.emoji = '🔩';
        this.isActive = false;
        this.ropeInteractable = true;
        this.maxRopeDistance = 10; // Example value
    }

    toggle() {
        this.isActive = !this.isActive;
        console.log(`Lever toggled: ${this.isActive}`);
    }
}
