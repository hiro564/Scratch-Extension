// Scratch地図拡張機能 - 超シンプル版
// まず動作することを最優先にしたバージョン

class MapExtension {
    getInfo() {
        return {
            id: 'map',
            name: '地図',
            blocks: [
                {
                    opcode: 'test',
                    blockType: 'reporter',
                    text: 'テスト'
                },
                {
                    opcode: 'setCenter',
                    blockType: 'command',
                    text: '地図中心: 緯度[LAT] 経度[LON]',
                    arguments: {
                        LAT: {
                            type: 'number',
                            defaultValue: 35.6762
                        },
                        LON: {
                            type: 'number',
                            defaultValue: 139.6503
                        }
                    }
                },
                {
                    opcode: 'moveToLatLon',
                    blockType: 'command',
                    text: '緯度[LAT] 経度[LON] へ移動',
                    arguments: {
                        LAT: {
                            type: 'number',
                            defaultValue: 35.6762
                        },
                        LON: {
                            type: 'number',
                            defaultValue: 139.6503
                        }
                    }
                },
                {
                    opcode: 'getLat',
                    blockType: 'reporter',
                    text: '現在の緯度'
                },
                {
                    opcode: 'getLon',
                    blockType: 'reporter',
                    text: '現在の経度'
                }
            ]
        };
    }

    constructor() {
        this.centerLat = 35.6762;
        this.centerLon = 139.6503;
        this.zoom = 15;
    }

    test() {
        return '拡張機能は正常に動作しています！';
    }

    setCenter(args) {
        this.centerLat = Number(args.LAT);
        this.centerLon = Number(args.LON);
    }

    moveToLatLon(args, util) {
        const lat = Number(args.LAT);
        const lon = Number(args.LON);
        
        // 簡易的な座標変換
        const scale = Math.pow(2, this.zoom + 8);
        const centerX = this.centerLon * scale / 360;
        const centerY = this.centerLat * scale / 360;
        const targetX = lon * scale / 360;
        const targetY = lat * scale / 360;
        
        const x = (targetX - centerX);
        const y = (centerY - targetY);
        
        util.target.setXY(x, y);
    }

    getLat(args, util) {
        const scale = Math.pow(2, this.zoom + 8);
        const centerY = this.centerLat * scale / 360;
        const targetY = centerY - util.target.y;
        const lat = targetY * 360 / scale;
        return Math.round(lat * 1000000) / 1000000;
    }

    getLon(args, util) {
        const scale = Math.pow(2, this.zoom + 8);
        const centerX = this.centerLon * scale / 360;
        const targetX = centerX + util.target.x;
        const lon = targetX * 360 / scale;
        return Math.round(lon * 1000000) / 1000000;
    }
}

// 拡張機能を登録
(function() {
    const extensionInstance = new MapExtension();
    Scratch.extensions.register(extensionInstance);
})();
