import * as s  from '@minecraft/server';
import * as ui from '@minecraft/server-ui';
import * as gt from '@minecraft/server-gametest';

/*
    worldedit-be v0.1.0
    template for making mods using ncb (new codebase)
*/

let webe = {
    ver: 'worldedit-be v0.1.0 - ncb0.1.0',
    methods: {
        check_op: function(player) { // wrap the operator check, to make things easier
            if (player.commandPermissionLevel >= 2) return true;
            return false
        },
        area: function(pos1, pos2) {
            let width  = Math.abs(pos2.x - pos1.x) + 1
            let height = Math.abs(pos2.y - pos1.y) + 1
            let depth  = Math.abs(pos2.z - pos1.z) + 1

            return width * height * depth
        },
        random_entries(entries) {
            let total = 0;
            let cumulative = entries.map(([chance, value]) => {
                total += chance;
                return [total, value];
            });
          
            if (total <= 0) throw new Error("Total chance must be greater than 0");
          
            let roll = Math.random() * total;
          
            for (let [threshold, value] of cumulative) {
                if (roll < threshold) return value;
            }
          
            return cumulative[cumulative.length - 1][1]; // fallback
        },
        equal_random(entries) {
            if (!entries.length) throw new Error("No entries provided");
            let index = Math.floor(Math.random() * entries.length);
            return entries[index];
        },

        parse_pattern: function(pattern) {
            // parse the pattern
            pattern = pattern.trim()
            if (pattern.includes(',')) {
                let blocks = pattern.split(',').map(b => b.trim());
                let types = blocks.map(b => {
                    if (b.includes('%')) {
                        // if percentage, its percent-based random
                        let chance = parseFloat(b.split('%')[0].trim());
                        let block = b.split('%')[1].trim() 
                        if (!s.BlockTypes.get(block))
                            throw new Error(`Error parsing pattern - Invalid block type \'${block}\'`);

                        if (isNaN(chance) || chance < 0 || chance > 100)
                            throw new Error(`Error parsing pattern - Invalid chance value \'${chance}\'`);

                        return [chance, block];
                    } else {
                        if (s.BlockTypes.get(b)) {
                            return s.BlockTypes.get(b);
                        } else {
                            throw new Error(`Error parsing pattern - Invalid block type \'${b}\'`);
                        }
                    }
                });
                return () => types[0].length > 1 ? webe.methods.random_entries(types) : webe.methods.equal_random(types); // return a random block type from the list
            } else {
                if (s.BlockTypes.get(pattern)) {
                    return () => s.BlockTypes.get(pattern);
                } else {
                    throw new Error(`Error parsing pattern - Invalid block type \'${pattern}\'`);
                }
            }
        },
        setblock: function(pos, pattern, dimension=s.world.getDimension('minecraft:overworld')) {
            let p = pattern;
            if (pos.y < -64 || pos.y > 319) return 0;
            let b = dimension.getBlock(pos);
            let type = p()
            if (b && (s.BlockTypes.get(b.type.id) !== type)) {
                b.setType(type);
                return 1;
            }
            return 0;
        },
        fill: function(pos1, pos2, pattern, dimension=s.world.getDimension('minecraft:overworld')) {
            pattern = webe.methods.parse_pattern(pattern)
            let
                x1 = Math.min(pos1.x, pos2.x),
                y1 = Math.min(pos1.y, pos2.y),
                z1 = Math.min(pos1.z, pos2.z),
                x2 = Math.max(pos1.x, pos2.x),
                y2 = Math.max(pos1.y, pos2.y),
                z2 = Math.max(pos1.z, pos2.z);
            let i = 0;
            for (let x = x1; x <= x2; x++) {
                for (let y = y1; y <= y2; y++) {
                    for (let z = z1; z <= z2; z++) {
                        i += this.setblock({x, y, z}, pattern, dimension); // increment the Blocks Affected counter
                    }
                }
            }

            return i; // return the number of blocks affected
        },
        del: function(pos1, pos2, dimension=s.world.getDimension('minecraft:overworld')) {
            let
                x1 = Math.min(pos1.x, pos2.x),
                y1 = Math.min(pos1.y, pos2.y),
                z1 = Math.min(pos1.z, pos2.z),
                x2 = Math.max(pos1.x, pos2.x),
                y2 = Math.max(pos1.y, pos2.y),
                z2 = Math.max(pos1.z, pos2.z);
            let i = 0;
            for (let x = x1; x <= x2; x++) {
                for (let y = y1; y <= y2; y++) {
                    for (let z = z1; z <= z2; z++) {
                        i += this.setblock({x, y, z}, () => 'air', dimension); // increment the Blocks Affected counter
                    }
                }
            }

            return i; // return the number of blocks affected
        },
        replace: function(pos1, pos2, from, to, dimension=s.world.getDimension('minecraft:overworld')) {
            to = webe.methods.parse_pattern(to)
            let
                x1 = Math.min(pos1.x, pos2.x),
                y1 = Math.min(pos1.y, pos2.y),
                z1 = Math.min(pos1.z, pos2.z),
                x2 = Math.max(pos1.x, pos2.x),
                y2 = Math.max(pos1.y, pos2.y),
                z2 = Math.max(pos1.z, pos2.z);
            let i = 0;
            if (!s.BlockTypes.get(from))
                throw new Error(`Error parsing pattern - Invalid block type \'${from}\'`);
                
            for (let x = x1; x <= x2; x++) {
                for (let y = y1; y <= y2; y++) {
                    for (let z = z1; z <= z2; z++) {
                        if (y < -64 || y > 319) continue;
                        let b = dimension.getBlock({x, y, z});
                        if (b && s.BlockTypes.get(b.type.id) === s.BlockTypes.get(from))
                            i += this.setblock({x, y, z}, to, dimension); // increment the Blocks Affected counter
                        else continue;
                    }
                }
            }

            return i; // return the number of blocks affected
        },
        sphere: function(c, r, pattern, dimension=s.world.getDimension('minecraft:overworld'), h = false) {
            pattern = webe.methods.parse_pattern(pattern)
            let rs = r ** 2;
            let rs2 = (r - 1) ** 2;
            let i = 0;
            if (r < 1) return 0;

            for (let x = -r; x <= r; x++) {
                for (let y = -r; y <= r; y++) {
                    for (let z = -r; z <= r; z++) {
                        if (c.y + y < -64 || c.y + y > 319) continue;
                        let ds = x * x + y * y + z * z;

                        // How many non-zero directions is this block offset in?
                        let components = [Math.abs(x),Math.abs(y), Math.abs(z)].filter(v => v > 0).length;

                        // Slight bias: if only 1 axis is offset, shrink the radius a bit
                        let bias = (components === 1) ? 0.3 : 0;

                        if (!h && ds <= rs - bias || h && ds <= rs - bias && ds >= rs2) {
                            let pos = {
                                x: c.x + x,
                                y: c.y + y,
                                z: c.z + z
                            };
                            i += this.setblock(pos, pattern, dimension);
                        }
                    }
                }
            }
            return i;
        },
        cyl: function(c, r, height, pattern, dimension=s.world.getDimension('minecraft:overworld'), h = false) {
            pattern = webe.methods.parse_pattern(pattern)
            let rs = r ** 2;
            let rs2 = (r - 1) ** 2;
            let i = 0;
            if (r < 1) return 0;

            for (let x = -r; x <= r; x++) {
                for (let y = 0; y <= height; y++) {
                    for (let z = -r; z <= r; z++) {
                        if (c.y + y < -64 || c.y + y > 319) continue;
                        let ds = x * x + z * z;

                        // How many non-zero directions is this block offset in?
                        let components = [Math.abs(x), Math.abs(z)].filter(v => v > 0).length;

                        // Slight bias: if only 1 axis is offset, shrink the radius a bit
                        let bias = (components === 1) ? 0.3 : 0;

                        if (!h && ds <= rs - bias || h && ds <= rs - bias && ds >= rs2) {
                            let pos = {
                                x: c.x + x,
                                y: c.y + y,
                                z: c.z + z
                            };
                            i += this.setblock(pos, pattern, dimension);
                        }
                    }
                }
            }
            return i;
        },
        pyramid: function(c, r, pattern, dimension=s.world.getDimension('minecraft:overworld'), h = false) {
            pattern = webe.methods.parse_pattern(pattern)
            if (r < 1) return 0;
            let i = 0;

            for (let y = 0; y <= r; y++) {
                let size = r - y;

                for (let x = -size; x <= size; x++) {
                    for (let z = -size; z <= size; z++) {

                        // Hollow check
                        if (h) {
                            let edge = (
                                x === -size || x === size ||
                                z === -size || z === size
                            );
                            if (!edge) continue;
                        }

                        let pos = {
                            x: c.x + x,
                            y: c.y + y,
                            z: c.z + z
                        };
                        i += this.setblock(pos, pattern, dimension);
                    }
                }
            }

            return i;
        },
        fix_water: function(c, r, dimension=s.world.getDimension('minecraft:overworld')) {
            let rs = r ** 2;
            let rs2 = (r - 1) ** 2;
            let i = 0;
            if (r < 1) return 0;

            for (let x = -r; x <= r; x++) {
                for (let y = -r; y <= r; y++) {
                    for (let z = -r; z <= r; z++) {
                        if (c.y + y < -64 || c.y + y > 319) continue;
                        let ds = x * x + y * y + z * z;

                        // How many non-zero directions is this block offset in?
                        let abs = Math.abs;
                        let components = [abs(x), abs(y), abs(z)].filter(v => v > 0).length;

                        // Slight bias: if only 1 axis is offset, shrink the radius a bit
                        let bias = (components === 1) ? 0.3 : 0;

                        if (ds <= rs - bias) {
                            let b = dimension.getBlock({x: c.x + x, y: c.y + y, z: c.z + z});
                            let perm = b?.permutation;
                            if (!b || (b.type.id !== 'minecraft:water' && b.type.id !== 'minecraft:flowing_water')) continue;
                            if (b && perm && perm.getState('liquid_depth') !== 0) {
                                i += this.setblock({x: c.x + x, y: c.y + y, z: c.z + z}, () => 'water', dimension);
                            } else continue;
                        }
                    }
                }
            }
            return i;
        },
        fix_lava: function(c, r, dimension=s.world.getDimension('minecraft:overworld')) {
            let rs = r ** 2;
            let rs2 = (r - 1) ** 2;
            let i = 0;
            if (r < 1) return 0;

            for (let x = -r; x <= r; x++) {
                for (let y = -r; y <= r; y++) {
                    for (let z = -r; z <= r; z++) {
                        if (c.y + y < -64 || c.y + y > 319) continue;
                        let ds = x * x + y * y + z * z;

                        // How many non-zero directions is this block offset in?
                        let abs = Math.abs;
                        let components = [abs(x), abs(y), abs(z)].filter(v => v > 0).length;

                        // Slight bias: if only 1 axis is offset, shrink the radius a bit
                        let bias = (components === 1) ? 0.3 : 0;

                        if (ds <= rs - bias) {
                            let b = dimension.getBlock({x: c.x + x, y: c.y + y, z: c.z + z});
                            let perm = b?.permutation;
                            if (!b || (b.type.id !== 'minecraft:lava' && b.type.id !== 'minecraft:flowing_lava')) continue;
                            if (b && perm && perm.getState('liquid_depth') !== 0) {
                                i += this.setblock({x: c.x + x, y: c.y + y, z: c.z + z}, () => 'lava', dimension);
                            } else continue;
                        }
                    }
                }
            }
            return i;
        },
        drain: function(c, r, dimension=s.world.getDimension('minecraft:overworld'), w=false) {
            let rs = r ** 2;
            let rs2 = (r - 1) ** 2;
            let i = 0;
            if (r < 1) return 0;
            for (let x = -r; x <= r; x++) {
                for (let y = -r; y <= r; y++) {
                    for (let z = -r; z <= r; z++) {
                        let ds = x * x + y * y + z * z;

                        // How many non-zero directions is this block offset in?
                        let abs = Math.abs;
                        let components = [abs(x), abs(y), abs(z)].filter(v => v > 0).length;

                        // Slight bias: if only 1 axis is offset, shrink the radius a bit
                        let bias = (components === 1) ? 0.3 : 0;

                        if (ds <= rs - bias) {
                                if (c.y + y < -64 || c.y + y > 319) continue;
                            let b = dimension.getBlock({x: c.x + x, y: c.y + y, z: c.z + z});
                            if (b && (b.type.id === 'minecraft:water' || b.type.id === 'minecraft:flowing_water')) {
                                i += this.setblock({x: c.x + x, y: c.y + y, z: c.z + z}, () => 'air', dimension);
                            }

                            if (b && (b.type.id === 'minecraft:lava' || b.type.id === 'minecraft:flowing_lava')) {
                                i += this.setblock({x: c.x + x, y: c.y + y, z: c.z + z}, () => 'air', dimension);
                            }

                            if (w && b) {
                                b.setWaterlogged(false)
                            }
                        }
                    }
                }
            }
            return i;
        },
        replacenear: function(c, r, dimension=s.world.getDimension('minecraft:overworld'), from, to) {
            to = webe.methods.parse_pattern(to)
            let i = 0;
            for (let x = -r; x <= r; x++) {
                for (let y = -r; y <= r; y++) {
                    for (let z = -r; z <= r; z++) {
                        if (c.y + y < -64 || c.y + y > 319) continue;
                        let b = dimension.getBlock({x: c.x + x, y: c.y + y, z: c.z + z});
                        if (b && s.BlockTypes.get(b.type.id) === s.BlockTypes.get(from))
                            i += this.setblock({x: c.x + x, y: c.y + y, z: c.z + z}, to, dimension); // increment the Blocks Affected counter
                    }
                }
            }
            return i;
        },
        walls: function(pos1, pos2, pattern, dimension) {
            pattern = webe.methods.parse_pattern(pattern)
            let x1 = Math.min(pos1.x, pos2.x);
            let x2 = Math.max(pos1.x, pos2.x);
            let y1 = Math.min(pos1.y, pos2.y);
            let y2 = Math.max(pos1.y, pos2.y);
            let z1 = Math.min(pos1.z, pos2.z);
            let z2 = Math.max(pos1.z, pos2.z);
            let i = 0;

            for (let x = x1; x <= x2; x++) {
                for (let y = y1; y <= y2; y++) {
                    // Z walls (front and back)
                    i += this.setblock({ x, y, z: z1 }, pattern, dimension);
                    i += this.setblock({ x, y, z: z2 }, pattern, dimension);
                }
            }

            for (let z = z1; z <= z2; z++) {
                for (let y = y1; y <= y2; y++) {
                    // X walls (left and right)
                    i += this.setblock({ x: x1, y, z }, pattern, dimension);
                    i += this.setblock({ x: x2, y, z }, pattern, dimension);
                }
            }

            return i;
        }
    },
    debug: {
        run_thru: function(v) {
            return eval(v);
        }
    },
    command_prefix: '#',
    commands: [
        {
            name: 'help',
            desc: 'Shows all of the available commands.',
            syntax: [
                '#\xa7ehelp \xa7i[\xa7fcommand\xa7i]',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase()
                    if (c) {
                        let cmd = webe.commands.find(cmd => `${webe.command_prefix}${cmd.name}` === c || `${cmd.name}` === c);
                        player.sendMessage(`\xa7f${webe.command_prefix}\xa7e${cmd.name}\xa7f - \xa7i\xa7o${cmd.desc}\xa7r`);
                        cmd.send_usage(player); // send the usage of the command
                    } else {
                        let msg = '\xa7eCommands\xa7f:'
                        for (let command of webe.commands.filter(cmd => cmd.requires_op)) {
                            msg += `\n    \xa7f${webe.command_prefix}\xa7e${command.name} \xa7i- \xa7i\xa7o${command.desc}\xa7r`;
                        }
                        player.sendMessage(`${msg}`);
                    }
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'deselect',
            desc: 'Deselects the current region selection.',
            syntax: [
                '#\xa7edeselect',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    if (player.getDynamicProperty('webe:pos1') || player.getDynamicProperty('webe:pos2')) {
                        player.setDynamicProperty('webe:pos1', undefined); // clear the first position
                        player.setDynamicProperty('webe:pos2', undefined); // clear the second position
                        player.sendMessage(`\xa7eSelection cleared\xa7f.`);
                    } else {
                        player.sendMessage(`\xa7cMake a region selection first\xa7f.`);
                    }
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'pos1',
            desc: 'Set position 1.',
            syntax: [
                '#\xa7epos1 \xa7i[\xa7fx\xa7i] \xa7i[\xa7fy\xa7i] \xa7i[\xa7fz\xa7i]',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase(),
                        d = a[2]?.trim()?.toLowerCase(),
                        e = a[3]?.trim()?.toLowerCase()

                    
                    if (c && c !== '')
                        if (isNaN(parseInt(c)) || (parseFloat(c) % 1 !== 0)) {
                            player.sendMessage('\xa7cOne or more parameters are invalid\xa7f.');
                            this.send_usage(player);
                            return;
                        }

                    if (d && d !== '')
                        if (isNaN(parseInt(d)) || (parseFloat(d) % 1 !== 0)) {
                            player.sendMessage('\xa7cOne or more parameters are invalid\xa7f.');
                            this.send_usage(player);
                            return;
                        }

                    if (e && e !== '')
                        if (isNaN(parseInt(e)) || (parseFloat(e) % 1 !== 0)) {
                            player.sendMessage('\xa7cOne or more parameters are invalid\xa7f.');
                            this.send_usage(player);
                            return;
                        }
                    let npos = {
                        x: !c || c === '' ? Math.floor(player.location.x) : parseInt(c),
                        y: !d || d === '' ? Math.floor(player.location.y) : parseInt(d),
                        z: !e || e === '' ? Math.floor(player.location.z) : parseInt(e)
                    }
                    player.setDynamicProperty('webe:pos1', npos);
                    player.sendMessage(`\xa7eFirst position set to \xa7f(\xa7e${npos.x}\xa7f, \xa7e${npos.y}\xa7f, \xa7e${npos.z}\xa7f)${player.getDynamicProperty('webe:pos1') ? ' \xa7f(\xa7e' + webe.methods.area(player.getDynamicProperty('webe:pos2'), npos) + '\xa7f)' : ''}.`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'pos2',
            desc: 'Set position 2.',
            syntax: [
                '#\xa7epos2 \xa7i[\xa7fx\xa7i] \xa7i[\xa7fy\xa7i] \xa7i[\xa7fz\xa7i]',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase(),
                        d = a[2]?.trim()?.toLowerCase(),
                        e = a[3]?.trim()?.toLowerCase()

                    if (c && c !== '')
                        if (isNaN(parseInt(c)) || (parseFloat(c) % 1 !== 0)) {
                            player.sendMessage('\xa7cOne or more parameters are invalid\xa7f.');
                            this.send_usage(player);
                            return;
                        }

                    if (d && d !== '')
                        if (isNaN(parseInt(d)) || (parseFloat(d) % 1 !== 0)) {
                            player.sendMessage('\xa7cOne or more parameters are invalid\xa7f.');
                            this.send_usage(player);
                            return;
                        }

                    if (e && e !== '')
                        if (isNaN(parseInt(e)) || (parseFloat(e) % 1 !== 0)) {
                            player.sendMessage('\xa7cOne or more parameters are invalid\xa7f.');
                            this.send_usage(player);
                            return;
                        }
                    let npos = {
                        x: !c || c === '' ? Math.floor(player.location.x) : parseInt(c),
                        y: !d || d === '' ? Math.floor(player.location.y) : parseInt(d),
                        z: !e || e === '' ? Math.floor(player.location.z) : parseInt(e)
                    }
                    player.setDynamicProperty('webe:pos2', npos);
                    player.sendMessage(`\xa7eSecond position set to \xa7f(\xa7e${npos.x}\xa7f, \xa7e${npos.y}\xa7f, \xa7e${npos.z}\xa7f)${player.getDynamicProperty('webe:pos1') ? ' \xa7f(\xa7e' + webe.methods.area(player.getDynamicProperty('webe:pos1'), npos) + '\xa7f)' : ''}.`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'wand',
            desc: 'Get the wand item.',
            syntax: [
                '#\xa7dwand',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let wand = new s.ItemStack('minecraft:wooden_axe', 1)

                    wand.nameTag = '\xa7r\xa7eWand'
                    wand.setLore([
                        '\xa7r\xa7eLeft click\xa7f: \xa7eselect pos \xa7f#\xa7e1\xa7f; \xa7eRight click\xa7f: \xa7eselect pos \xa7f#\xa7e2\xa7f.'
                    ])

                    let container = player.getComponent('minecraft:inventory').container;
                    container.setItem(container.firstEmptySlot(), wand)

                    player.sendMessage('\xa7eYou have been given a wand\xa7f. \xa7eLeft click\xa7f: \xa7eselect pos \xa7f#\xa7e1\xa7f; \xa7eRight click\xa7f: \xa7eselect pos \xa7f#\xa7e2\xa7f.')
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'up',
            desc: 'Go upwards some distance.',
            syntax: [
                '#\xa7eup \xa7i<\xa7fdistance\xa7i> [\xa7f-n\xa7i]',
            ],
            flags: ['-n'],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase()
                    if (!c || c === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fdistance\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (isNaN(parseInt(c)) || (parseFloat(c) % 1 !== 0)) {
                        player.sendMessage('\xa7cInvalid value for \xa7i<\xa7fdistance\xa7i>\xa7c, acceptable values are any integer.');
                        this.send_usage(player);
                        return;
                    }
                    if (parseInt(c) < 0) {
                        player.sendMessage('\xa7cCan\'t use negative values for \xa7i<\xa7fdistance\xa7i>\xa7f.');
                        this.send_usage(player);
                        return;
                    }
                    player.sendMessage('\xa7eWoosh\xa7f!')
                    player.teleport({
                        x: Math.floor(player.location.x) + 0.5,
                        y: player.location.y + (parseInt(c)),
                        z: Math.floor(player.location.z) + 0.5
                    });
                    if (!a.join(' ').includes('-n')) {
                        let b = player.dimension.getBlock({
                            x: player.location.x,
                            y: player.location.y - 1,
                            z: player.location.z
                        })

                        if (!b || b.typeId === 'minecraft:air')
                            webe.methods.setblock({
                                x: player.location.x,
                                y: player.location.y - 1,
                                z: player.location.z
                            }, () => 'glass', player.dimension); // set a block below the player's feet
                    }
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'fixwater',
            desc: 'Fix water to be stationary.',
            syntax: [
                '#\xa7efixwater \xa7i<\xa7fradius\xa7i>]',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase()
                    if (!c || c === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fradius\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (isNaN(parseInt(c)) || (parseFloat(c) % 1 !== 0)) {
                        player.sendMessage('\xa7cInvalid value for \xa7i<\xa7fradius\xa7i>\xa7c, acceptable values are any integer.');
                        this.send_usage(player);
                        return;
                    }
                    if (parseInt(c) < 0) {
                        player.sendMessage('\xa7cCan\'t use negative values for \xa7i<\xa7fradius\xa7i>\xa7f.');
                        this.send_usage(player);
                        return;
                    }
                    let aff = webe.methods.fix_water(player.location, parseInt(c), player.dimension)
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks fixed\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'fixlava',
            desc: 'Fix lava to be stationary.',
            syntax: [
                '#\xa7efixlava \xa7i<\xa7fradius\xa7i>',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase()
                    if (!c || c === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fradius\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (isNaN(parseInt(c)) || (parseFloat(c) % 1 !== 0)) {
                        player.sendMessage('\xa7cInvalid value for \xa7i<\xa7fradius\xa7i>\xa7c, acceptable values are any integer.');
                        this.send_usage(player);
                        return;
                    }
                    if (parseInt(c) < 0) {
                        player.sendMessage('\xa7cCan\'t use negative values for \xa7i<\xa7fradius\xa7i>\xa7f.');
                        this.send_usage(player);
                        return;
                    }
                    let aff = webe.methods.fix_lava(player.location, parseInt(c), player.dimension)
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks fixed\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'drain',
            desc: 'Drain water/lava.',
            syntax: [
                '#\xa7edrain \xa7i<\xa7fradius\xa7i>',
            ],
            flags: ['-w'],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase()
                    if (!c || c === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fradius\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (isNaN(parseInt(c)) || (parseFloat(c) % 1 !== 0)) {
                        player.sendMessage('\xa7cInvalid value for \xa7i<\xa7fradius\xa7i>\xa7c, acceptable values are any integer.');
                        this.send_usage(player);
                        return;
                    }
                    if (parseInt(c) < 0) {
                        player.sendMessage('\xa7cCan\'t use negative values for \xa7i<\xa7fradius\xa7i>\xa7f.');
                        this.send_usage(player);
                        return;
                    }
                    let aff = webe.methods.drain(player.location, parseInt(c), player.dimension, a.join(' ').includes('-w'))
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks drained\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'set',
            desc: 'Sets all blocks in the region.',
            syntax: [
                '#\xa7eset \xa7i<\xa7fpattern\xa7i>',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase(),
                        input = a.slice(1).join(' ');
                    if (!input || input === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fpattern\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (!player.getDynamicProperty('webe:pos1') || !player.getDynamicProperty('webe:pos2')) {
                        player.sendMessage(`\xa7cMake a region selection first\xa7f.`);
                        return;
                    }
                    let aff = webe.methods.fill(player.getDynamicProperty('webe:pos1'), player.getDynamicProperty('webe:pos2'), input, player.dimension); // fill the region with the pattern
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks affected\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'del',
            desc: 'Removes all blocks in the region.',
            syntax: [
                '#\xa7edel',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase(),
                        input = a.slice(1).join(' ');

                    if (!player.getDynamicProperty('webe:pos1') || !player.getDynamicProperty('webe:pos2')) {
                        player.sendMessage(`\xa7cMake a region selection first\xa7f.`);
                        return;
                    }
                    let aff = webe.methods.del(player.getDynamicProperty('webe:pos1'), player.getDynamicProperty('webe:pos2'), player.dimension); // fill the region with the pattern
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks removed\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'walls',
            desc: 'Build the four sides of the selection.',
            syntax: [
                '#\xa7ewalls \xa7i<\xa7fpattern\xa7i>',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase(),
                        input = a.slice(1).join(' ');
                    if (!input || input === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fpattern\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (!player.getDynamicProperty('webe:pos1') || !player.getDynamicProperty('webe:pos2')) {
                        player.sendMessage(`\xa7cMake a region selection first\xa7f.`);
                        return;
                    }
                    let aff = webe.methods.walls(player.getDynamicProperty('webe:pos1'), player.getDynamicProperty('webe:pos2'), input, player.dimension); // fill the region with the pattern
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks affected\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'replace',
            desc: 'Replace all blocks in the selection with another.',
            syntax: [
                '#\xa7ereplace \xa7i<\xa7ffrom\xa7i> <\xa7fto\xa7i>',
            ],
            flags: [],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase(),
                        input = a.slice(2).join(' ');
                    if (!input || input === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fpattern\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (!player.getDynamicProperty('webe:pos1') || !player.getDynamicProperty('webe:pos2')) {
                        player.sendMessage(`\xa7cMake a region selection first\xa7f.`);
                        return;
                    }
                    let aff = webe.methods.replace(player.getDynamicProperty('webe:pos1'), player.getDynamicProperty('webe:pos2'), c, input, player.dimension); // fill the region with the pattern
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks affected\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'sphere',
            desc: 'Generates a sphere.',
            syntax: [
                '#\xa7esphere \xa7i<\xa7fpattern\xa7i> \xa7i<\xa7fradius\xa7i> \xa7i[\xa7f-h\xa7i]',
            ],
            flags: ['-h'],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase(),
                        d = a[2]?.trim()?.toLowerCase()

                    let h = false;
                    if (!c || c === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fpattern\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (!d || d === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fradius\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (isNaN(parseInt(d)) || (parseFloat(d) % 1 !== 0)) {
                        player.sendMessage('\xa7cInvalid value for \xa7i<\xa7fradius\xa7i>\xa7c, acceptable values are any integer.');
                        this.send_usage(player);
                        return;
                    }
                    if (a.join(' ').includes('-h')) h = true; else h = false;

                    let aff = webe.methods.sphere(player.location, parseInt(d), c, player.dimension, h)
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks affected\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'cyl',
            desc: 'Generates a cylinder.',
            syntax: [
                '#\xa7ecyl \xa7i<\xa7fpattern\xa7i> \xa7i<\xa7fradius\xa7i> \xa7i<\xa7fheight\xa7i> \xa7i[\xa7f-h\xa7i]',
            ],
            flags: ['-h'],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase(),
                        d = a[2]?.trim()?.toLowerCase(),
                        e = a[3]?.trim()?.toLowerCase()

                    let h = false;
                    if (!c || c === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fpattern\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (!d || d === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fradius\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (!e || e === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fheight\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (isNaN(parseInt(d)) || (parseFloat(d) % 1 !== 0)) {
                        player.sendMessage('\xa7cInvalid value for \xa7i<\xa7fradius\xa7i>\xa7c, acceptable values are any integer.');
                        this.send_usage(player);
                        return;
                    }
                    if (isNaN(parseInt(e)) || (parseFloat(e) % 1 !== 0)) {
                        player.sendMessage('\xa7cInvalid value for \xa7i<\xa7fheight\xa7i>\xa7c, acceptable values are any integer.');
                        this.send_usage(player);
                        return;
                    }
                    if (a.join(' ').includes('-h')) h = true; else h = false;

                    let aff = webe.methods.cyl(player.location, parseInt(d), parseInt(e), c, player.dimension, h)
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks affected\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'replacenear',
            desc: 'Replace nearby blocks.',
            syntax: [
                '#\xa7ereplacenear \xa7i<\xa7fradius\xa7i> \xa7i<\xa7ffrom\xa7i> \xa7i<\xa7fto\xa7i>',
            ],
            flags: ['-h'],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase(),
                        d = a[2]?.trim()?.toLowerCase(),
                        e = a[3]?.trim()?.toLowerCase()

                    let h = false;
                    if (!d || d === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7ffrom\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (!e || e === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fto\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (!c || c === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fradius\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (isNaN(parseInt(c)) || (parseFloat(c) % 1 !== 0)) {
                        player.sendMessage('\xa7cInvalid value for \xa7i<\xa7fradius\xa7i>\xa7c, acceptable values are any integer.');
                        this.send_usage(player);
                        return;
                    }

                    let aff = webe.methods.replacenear(player.location, parseInt(c), player.dimension, d, e)
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks replaced\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        },
        {
            name: 'pyramid',
            desc: 'Generates a pyramid.',
            syntax: [
                '#\xa7epyramid \xa7i<\xa7fpattern\xa7i> \xa7i<\xa7fsize\xa7i> \xa7i[\xa7f-h\xa7i]',
            ],
            flags: ['-h'],
            requires_op: true,
            send_usage: function(player) {
                player.sendMessage('\xa7eUsage\xa7f: \n    ' + this.syntax.join('\n'));
            },
            func: function(a, player) {
                try {
                    let
                        b = a[0]?.trim()?.toLowerCase(),
                        c = a[1]?.trim()?.toLowerCase(),
                        d = a[2]?.trim()?.toLowerCase()

                    let h = false;
                    if (!c || c === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fpattern\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (!d || d === '') {
                        player.sendMessage('\xa7cMissing argument for \xa7i<\xa7fsize\xa7i>\xa7c.');
                        this.send_usage(player);
                        return;
                    }
                    if (isNaN(parseInt(d)) || (parseFloat(d) % 1 !== 0)) {
                        player.sendMessage('\xa7cInvalid value for \xa7i<\xa7fsize\xa7i>\xa7c, acceptable values are any integer.');
                        this.send_usage(player);
                        return;
                    }
                    if (a.join(' ').includes('-h')) h = true; else h = false;

                    let aff = webe.methods.pyramid(player.location, parseInt(d), c, player.dimension, h)
                    player.sendMessage(`\xa7eOperation completed\xa7f \xa7f(\xa7e${aff} blocks affected\xa7f).`);
                } catch (e) {
                    player.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            }
        }
    ].sort((a, b) => a.name !== 'help' && b.name !== 'help' ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : 0),
    listeners: {
        before_events: {
            chatSend: function(e) {
                try {
                    if (e.message.startsWith(webe.command_prefix) && webe.methods.check_op(e.sender)) { // check if the message starts with the command prefix and if the player is an operator
                        e.cancel = true; // cancel the chat message
                        let a = e.message.split(' '),
                            b = a[0]?.trim()?.toLowerCase(),
                            c = a[1]?.trim()?.toLowerCase()

                        let cmd = webe.commands.find(cmd => `${webe.command_prefix}${cmd.name}` === b) // stupid way of doing this, but it works
                        if (cmd) {
                            if (cmd.requires_op && !webe.methods.check_op(e.sender)) { // check if the command requires op and if the player is op
                                e.sender.sendMessage(`\xa7cYou don\'t have permission to use this command\xa7f!`);
                                return;
                            }
                            s.system.run(() => cmd.func(a, e.sender)) // run the command
                        } else
                            e.sender.sendMessage(`\xa7cNo such command \xa7f\'${webe.command_prefix}\xa7c${b.replace(webe.command_prefix, '')}\xa7f\'\xa7f!`); // send a message to the player that the command doesn't exist
                    }
                } catch (e) {
                    e.sender.sendMessage(`\xa7cERROR \xa7f- \xa7c${e.message}`); // send an error message to the player
                }
            },
            playerBreakBlock: function(e) {
                // runs when a player breaks a block
                let player = e.player;
                if (!webe.methods.check_op(player) || player.getGameMode() !== 'Creative') return; // if the player is not an operator, do nothing
                let equippable = e.player.getComponent('minecraft:equippable');
                if (equippable) {
                    let mainhand = equippable.getEquipmentSlot('Mainhand')?.getItem();

                    if (mainhand?.typeId === 'minecraft:wooden_axe') {
                        e.cancel = true; // cancel the block break event
                        if (s.system.currentTick - (player.getDynamicProperty('webe:last_set') ?? 0) < 10) return; // if the player is on cooldown, do nothing
                        player.setDynamicProperty('webe:pos1', e.block.location); // set the first position to the block location
                        player.sendMessage(`\xa7eFirst position set to \xa7f(\xa7e${e.block.location.x}\xa7f, \xa7e${e.block.location.y}\xa7f, \xa7e${e.block.location.z}\xa7f)${player.getDynamicProperty('webe:pos2') ? ' \xa7f(\xa7e' + webe.methods.area(player.getDynamicProperty('webe:pos2'), e.block.location) + '\xa7f)' : ''}.`);
                        player.setDynamicProperty('webe:last_set', s.system.currentTick); // set a cooldown
                    }
                }
            },
            playerInteractWithBlock: function(e) {
                // runs when a player breaks a block
                let player = e.player;
                if (!webe.methods.check_op(player) || player.getGameMode() !== 'Creative') return; // if the player is not an operator, do nothing
                let equippable = e.player.getComponent('minecraft:equippable');
                if (equippable) {
                    let mainhand = equippable.getEquipmentSlot('Mainhand')?.getItem();

                    if (mainhand?.typeId === 'minecraft:wooden_axe') {
                        e.cancel = true; // cancel the block break event
                        if (s.system.currentTick - (player.getDynamicProperty('webe:last_set') ?? 0) < 10) return; // if the player is on cooldown, do nothing
                        player.setDynamicProperty('webe:pos2', e.block.location); // set the first position to the block location
                        player.sendMessage(`\xa7eSecond position set to \xa7f(\xa7e${e.block.location.x}\xa7f, \xa7e${e.block.location.y}\xa7f, \xa7e${e.block.location.z}\xa7f)${player.getDynamicProperty('webe:pos1') ? ' \xa7f(\xa7e' + webe.methods.area(player.getDynamicProperty('webe:pos1'), e.block.location) + '\xa7f)' : ''}.`);
                        player.setDynamicProperty('webe:last_set', s.system.currentTick); // set a cooldown
                    }
                }
            }
        },
        after_events: {
            playerSpawn: function(e) {
                // runs when a player spawns

            }
        }
    },
    on_tick: function() {
        s.system.runInterval(() => {
            // runs every game tick
        })
    },
    on_load: function() {
        // runs when the script is loaded
        s.world.sendMessage(`\xa7eWorldEdit-BE \xa7f- \xa7eScript reloaded\xa7f!`);
    }
}
s.system.beforeEvents.watchdogTerminate.subscribe(e => {
    e.cancel = true;
    s.world.sendMessage(`\xa7coh god, the server almost died\xa7r\n    \xa7c${e.terminateReason}`)
})
s.world.afterEvents.worldLoad.subscribe(() => {
    for (let key of Object.keys(webe.listeners.before_events)) {
        s.world.beforeEvents[key].subscribe(webe.listeners.before_events[key]);
    }
    for (let key of Object.keys(webe.listeners.after_events)) {
        s.world.afterEvents[key].subscribe(webe.listeners.after_events[key]);
    }
    webe.on_load();
    webe.on_tick();
})