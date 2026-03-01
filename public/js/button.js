class Button {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.type = 'button';
        this.name = 'Button';
        this.emoji = '🔘';
        this.ropeInteractable = true;
        this.holdRequired = 0; // Example value
    }

    press() {
        console.log('Button pressed');
    }
}
