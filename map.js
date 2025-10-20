(function(Scratch) {
    'use strict';

    class MapExtension {
        getInfo() {
            return {
                id: 'geomap',
                name: '🗺️ 地図',
                color1: '#4C97FF',
                color2: '#3373CC',
                blocks: [
                    {
                        opcode: 'testBlock',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'テスト'
                    },
                    '---',
                    {
                        opcode: 'setCenter',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '地図中心 緯度 [LAT] 経度 [LON]',
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
                        opcode: 'setZoom',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'ズーム [ZOOM]',
                        arguments: {
                            ZOOM: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 15
                            }
                        }
                    },
                    '---',
                    {
                        opcode: 'moveTo',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '緯度 [LAT] 経度 [LON] に移動',
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
                        text: 'スプライトの緯度'
                    },
                    {
                        opcode: 'getLon',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'スプライトの経度'
                    },
                    '---',
                    {
                        opcode: 'getDistance',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '2点間の距離(m) [LAT1],[LON1] → [LAT2],[LON2]',
                        arguments: {
                            LAT1: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.68
                            },
                            LON1: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.77
                            },
                            LAT2: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.69
                            },
                            LON2: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.78
                            }
                        }
                    }
                ]
            };
        }

        constructor() {
            this.lat = 35.68;
            this.lon = 139.77;
            this.zoom = 15;
        }

        testBlock() {
            return '✅ 動作OK!';
        }

        setCenter(args) {
            this.lat = Scratch.Cast.toNumber(args.LAT);
            this.lon = Scratch.Cast.toNumber(args.LON);
        }

        setZoom(args) {
            this.zoom = Math.max(0, Math.min(20, Scratch.Cast.toNumber(args.ZOOM)));
        }

        moveTo(args, util) {
            const lat = Scratch.Cast.toNumber(args.LAT);
            const lon = Scratch.Cast.toNumber(args.LON);
            const xy = this.toXY(lat, lon);
            util.target.setXY(xy.x, xy.y);
        }

        getLat(args, util) {
            const latlon = this.toLatLon(util.target.x, util.target.y);
            return Math.round(latlon.lat * 1000000) / 1000000;
        }

        getLon(args, util) {
            const latlon = this.toLatLon(util.target.x, util.target.y);
            return Math.round(latlon.lon * 1000000) / 1000000;
        }

        getDistance(args) {
            const lat1 = Scratch.Cast.toNumber(args.LAT1);
            const lon1 = Scratch.Cast.toNumber(args.LON1);
            const lat2 = Scratch.Cast.toNumber(args.LAT2);
            const lon2 = Scratch.Cast.toNumber(args.LON2);

            const R = 6371000;
            const toRad = Math.PI / 180;
            const dLat = (lat2 - lat1) * toRad;
            const dLon = (lon2 - lon1) * toRad;
            
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1*toRad) * Math.cos(lat2*toRad) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            
            return Math.round(R * c);
        }

        toXY(lat, lon) {
            const s = Math.pow(2, this.zoom + 8);
            const cx = this.lon * s / 360;
            const cy = this.lat * s / 360;
            const tx = lon * s / 360;
            const ty = lat * s / 360;
            return { x: tx - cx, y: cy - ty };
        }

        toLatLon(x, y) {
            const s = Math.pow(2, this.zoom + 8);
            const cx = this.lon * s / 360;
            const cy = this.lat * s / 360;
            const tx = cx + x;
            const ty = cy - y;
            return { lat: ty * 360 / s, lon: tx * 360 / s };
        }
    }

    Scratch.extensions.register(new MapExtension());
})(Scratch);
