(function(Scratch) {
    class MapExt {
        getInfo() {
            return {
                id: 'map',
                name: 'Map',
                blocks: [{
                    opcode: 'test',
                    blockType: 'reporter',
                    text: 'test'
                }]
            };
        }
        test() {
            return 'OK';
        }
    }
    Scratch.extensions.register(new MapExt());
})(Scratch);
