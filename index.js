(function(Scratch) {
    'use strict';

    class ScratchMapExtension {
        getInfo() {
            return {
                id: 'geoMap',
                name: '🗺️ 地図',
                color1: '#4C97FF',
                color2: '#3373CC',
                blocks: [
                    {
                        opcode: 'testExtension',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '拡張機能テスト'
                    },
                    '---',
                    {
                        opcode: 'setMapCenter',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '地図中心: 緯度[LAT] 経度[LON]',
                        arguments: {
                            LAT: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.6762
                            },
                            LON: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.6503
                            }
                        }
                    },
                    {
                        opcode: 'setZoomLevel',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'ズームレベル [ZOOM]',
                        arguments: {
                            ZOOM: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 15
                            }
                        }
                    },
                    '---',
                    {
                        opcode: 'moveToLocation',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '緯度[LAT] 経度[LON] へ移動',
                        arguments: {
                            LAT: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.6762
                            },
                            LON: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.6503
                            }
                        }
                    },
                    '---',
                    {
                        opcode: 'getLatitude',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'スプライトの緯度'
                    },
                    {
                        opcode: 'getLongitude',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'スプライトの経度'
                    },
                    '---',
                    {
                        opcode: 'calculateDistance',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '距離(m): 緯度[LAT1]経度[LON1]→緯度[LAT2]経度[LON2]',
                        arguments: {
                            LAT1: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.6762
                            },
                            LON1: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.6503
                            },
                            LAT2: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.6812
                            },
                            LON2: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.7671
                            }
                        }
                    }
                ]
            };
        }

        constructor() {
            this.centerLat = 35.6762;
            this.centerLon = 139.6503;
            this.zoom = 15;
        }

        testExtension() {
            return '✅ 正常動作中！';
        }

        setMapCenter(args) {
            this.centerLat = Scratch.Cast.toNumber(args.LAT);
            this.centerLon = Scratch.Cast.toNumber(args.LON);
        }

        setZoomLevel(args) {
            this.zoom = Math.max(0, Math.min(20, Scratch.Cast.toNumber(args.ZOOM)));
        }

        moveToLocation(args, util) {
            const lat = Scratch.Cast.toNumber(args.LAT);
            const lon = Scratch.Cast.toNumber(args.LON);
            const pos = this.convertToXY(lat, lon);
            util.target.setXY(pos.x, pos.y);
        }

        getLatitude(args, util) {
            const pos = this.convertToLatLon(util.target.x, util.target.y);
            return Math.round(pos.lat * 1000000) / 1000000;
        }

        getLongitude(args, util) {
            const pos = this.convertToLatLon(util.target.x, util.target.y);
            return Math.round(pos.lon * 1000000) / 1000000;
        }

        calculateDistance(args) {
            const lat1 = Scratch.Cast.toNumber(args.LAT1);
            const lon1 = Scratch.Cast.toNumber(args.LON1);
            const lat2 = Scratch.Cast.toNumber(args.LAT2);
            const lon2 = Scratch.Cast.toNumber(args.LON2);

            const R = 6371000;
            const rad = Math.PI / 180;
            const dLat = (lat2 - lat1) * rad;
            const dLon = (lon2 - lon1) * rad;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1*rad) * Math.cos(lat2*rad) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            
            return Math.round(R * c);
        }

        convertToXY(lat, lon) {
            const scale = Math.pow(2, this.zoom + 8);
            const cx = this.centerLon * scale / 360;
            const cy = this.centerLat * scale / 360;
            const tx = lon * scale / 360;
            const ty = lat * scale / 360;
            
            return {
                x: tx - cx,
                y: cy - ty
            };
        }

        convertToLatLon(x, y) {
            const scale = Math.pow(2, this.zoom + 8);
            const cx = this.centerLon * scale / 360;
            const cy = this.centerLat * scale / 360;
            const tx = cx + x;
            const ty = cy - y;
            
            return {
                lat: ty * 360 / scale,
                lon: tx * 360 / scale
            };
        }
    }

    Scratch.extensions.register(new ScratchMapExtension());
})(Scratch);
