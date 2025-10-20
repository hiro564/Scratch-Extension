(function(Scratch) {
    'use strict';

    class MapExtension {
        getInfo() {
            return {
                id: 'mapExt',
                name: '地図',
                blocks: [
                    {
                        opcode: 'test',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'テスト'
                    },
                    '---',
                    {
                        opcode: 'setCenter',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '地図中心 緯度[LAT] 経度[LON]',
                        arguments: {
                            LAT: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.68
                            },
                            LON: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.77
                            }
                        }
                    },
                    {
                        opcode: 'moveTo',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '緯度[LAT] 経度[LON] へ移動',
                        arguments: {
                            LAT: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.68
                            },
                            LON: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.77
                            }
                        }
                    },
                    '---',
                    {
                        opcode: 'getLat',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '現在の緯度'
                    },
                    {
                        opcode: 'getLon',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '現在の経度'
                    }
                ]
            };
        }

        constructor() {
            this.lat = 35.68;
            this.lon = 139.77;
            this.zoom = 15;
        }

        test() {
            return '動作OK v1.0';
        }

        setCenter(args) {
            this.lat = Scratch.Cast.toNumber(args.LAT);
            this.lon = Scratch.Cast.toNumber(args.LON);
        }

        moveTo(args, util) {
            const lat = Scratch.Cast.toNumber(args.LAT);
            const lon = Scratch.Cast.toNumber(args.LON);
            
            const s = Math.pow(2, this.zoom + 8);
            const cx = this.lon * s / 360;
            const cy = this.lat * s / 360;
            const tx = lon * s / 360;
            const ty = lat * s / 360;
            
            util.target.setXY(tx - cx, cy - ty);
        }

        getLat(args, util) {
            const s = Math.pow(2, this.zoom + 8);
            const cy = this.lat * s / 360;
            const ty = cy - util.target.y;
            const lat = ty * 360 / s;
            return Math.round(lat * 1000000) / 1000000;
        }

        getLon(args, util) {
            const s = Math.pow(2, this.zoom + 8);
            const cx = this.lon * s / 360;
            const tx = cx + util.target.x;
            const lon = tx * 360 / s;
            return Math.round(lon * 1000000) / 1000000;
        }
    }

    Scratch.extensions.register(new MapExtension());
})(Scratch);
