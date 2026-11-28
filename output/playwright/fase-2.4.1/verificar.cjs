const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const repo = path.resolve(__dirname, '../../..');
const front = path.join(repo, 'fronted-tickets');
const qa = 'C:/Users/JESÚS/AppData/Local/CANVIA-QA/fase-2.2.3';
const { chromium } = require(path.join(qa, '../fase-2.2.2/diagnostics/npm-cache/_npx/0781488ce6d8f36f/node_modules/playwright-core'));
const read = file => fs.readFileSync(file, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const save = (name, value) => fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2));
const normalize = value => value.replace(/\s+/g, '').toLowerCase();

async function main() {
    const before = read(path.join(__dirname, 'styles-before.css')).replace(/\r\n/g, '\n');
    const after = read(path.join(front, 'src/styles.css')).replace(/\r\n/g, '\n');
    const ds = read(path.join(repo, 'docs/DESIGN_SYSTEM.md'));
    const marker = '/*\n * CANVIA Aurora Enterprise UI';
    assert.equal(after.slice(0, after.indexOf(marker)).trim().replace(/\r\n/g, '\n'), before.trim().replace(/\r\n/g, '\n'));
    const catalog = after.slice(after.indexOf('.canvia-tokens {'));
    const declarations = [...catalog.matchAll(/(--canvia-[\w-]+):\s*([^;]+);/g)];
    assert.equal(new Set(declarations.map(match => match[1])).size, declarations.length);

    const expected = {};
    const put = (key, value) => { expected['--canvia-' + key] = value; };
    const colorRows = /\| (Brand|Aurora|Surface|Text|Border|Focus) \| ([\w-]+) \| (#[\dA-F]{6})/g;
    for (const [, family, name, value] of ds.matchAll(colorRows)) {
        put(family === 'Focus' ? 'focus' : family.toLowerCase() + '-' + name, value);
    }
    for (const [, state, text, surface] of ds.matchAll(/\| (Success|Warning|Error|Info|Neutral) \| (#[\dA-F]{6}) \| (#[\dA-F]{6}) \|/g)) {
        put('state-' + state.toLowerCase() + '-text', text);
        put('state-' + state.toLowerCase() + '-surface', surface);
    }
    for (const [, name, value] of ds.matchAll(/\| (chart-[\w-]+) \| (#[\dA-F]{6}) \|/g)) put(name, value);
    put('surface-card-translucent', 'rgba(255, 255, 255, .94)');
    put('focus-width', '2px');
    put('font-family', 'Roboto, Arial, sans-serif');
    put('font-numeric', 'tabular-nums');
    for (const [, name, size, weight] of ds.matchAll(/\| (Display|Page title|Section title|Card title|Subtitle|Body|Table|Caption|KPI|KPI compact) \| (\d+px) \| (\d+) \|/g)) {
        const key = name.toLowerCase().replaceAll(' ', '-');
        put('font-size-' + key, size);
        put('font-weight-' + key, weight);
    }
    const scale = ds.match(/Escala: ([^.]+)\./)[1].match(/\d+/g);
    for (const size of scale) put('space-' + size, size + 'px');
    for (const [key, value] of Object.entries({ 'padding-dashboard': '24px', 'padding-mobile': '16px', 'gap-cards': '20px', 'padding-card': '24px', 'gap-sections': '32px' })) put(key, value);
    for (const [, name, value] of ds.matchAll(/\| (XS|SM|MD|LG|XL|Full) \| (\d+px) \|/g)) put('radius-' + name.toLowerCase(), value);
    put('radius-dialog', '20px');
    for (const [, level, value] of ds.matchAll(/\| ([0-3]) \| (none|0 \d+px \d+px rgba\([^\n]+?) \|/g)) put('elevation-' + level, value);
    const motion = { 'Feedback inmediato': 'feedback', Hover: 'hover', Estados: 'state', Filtros: 'filter', Sidenav: 'sidenav', 'Diálogos': 'dialog', Contenido: 'content', 'Skeleton shimmer': 'shimmer' };
    for (const [, name, value] of ds.matchAll(/\| (Feedback inmediato|Hover|Estados|Filtros|Sidenav|Diálogos|Contenido|Skeleton shimmer) \| (\d+ms) \|/g)) put('motion-' + motion[name], value);
    put('motion-easing', ds.match(/Easing: ([^.]+\([^\n]+\))\./)[1]);
    for (const [key, value] of Object.entries({ base: '#E5E9EE', highlight: '#F7F9FB', 'radius-block': '6px', 'radius-container': '16px' })) put('skeleton-' + key, value);
    const gradients = {};
    for (const [name, heading] of Object.entries({ light: 'Light', emerald: 'Emerald', sunset: 'Sunset', deep: 'Deep' })) {
        const section = ds.slice(ds.indexOf('#### Aurora ' + heading));
        gradients[name] = section.match(/```css\s+([\s\S]+?)```/)[1].trim();
        let value = gradients[name];
        if (name === 'light' || name === 'emerald') value = value.replace('#F7F9FB', 'var(--canvia-surface-page)');
        if (name === 'sunset') value = value.replace('#FFF5EB', 'var(--canvia-aurora-cream)');
        if (name === 'deep') value = value.replace('#16835B', 'var(--canvia-brand-green)').replace('#003421', 'var(--canvia-brand-green-deep)');
        put('gradient-aurora-' + name, gradients[name]);
        const declared = declarations.find(match => match[1] === '--canvia-gradient-aurora-' + name);
        assert.equal(normalize(declared[2]), normalize(value));
    }
    assert.deepEqual(declarations.map(match => match[1]).sort(), Object.keys(expected).sort());

    const manifest = JSON.parse(read(path.join(qa, 'consolidacion-2.2.3.4/manifiesto-maestro.json')));
    const references = manifest.referencias.filter(item => item.id.startsWith('R'));
    const reportChecks = ['pre', 'post'].map(stage => {
        const result = JSON.parse(read(path.join(qa, 'tokens-2.4.1-' + stage, 'capturas.json')));
        assert.equal(result.browser, manifest.reproduccionReportes.browser);
        assert.equal(result.rows.length, 8);
        for (const reference of references) {
            const row = result.rows.find(item => 'app-' + item.id === reference.componente);
            assert.equal(row.sha256, reference.sha256);
            assert.equal(row.width, reference.ancho);
            assert.equal(row.height, reference.alto);
        }
        return { stage, matched: result.rows.length, browser: result.browser };
    });
    const protectedFiles = new Map(manifest.dependenciasProtegidas.flatMap(item => item.archivos).map(item => [item.ruta, item.sha256]));
    for (const [file, hash] of protectedFiles) assert.equal(sha(fs.readFileSync(path.join(repo, file))), hash, file);

    const theme = require(path.join(front, 'node_modules/sass')).compile(path.join(front, 'src/material-theme.scss'), { loadPaths: [path.join(front, 'node_modules')] }).css;
    const offline = css => theme + css.replace(/@import\s+url\([^)]*\);/g, '');
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const comparisons = [];
    try {
        const context = await browser.newContext({ locale: 'es-PE', timezoneId: 'America/Lima', deviceScaleFactor: 1, serviceWorkers: 'block' });
        await context.route('**/*', route => route.abort());
        const page = await context.newPage();
        await page.setContent('<!doctype html><html><body></body></html>');
        const tokenSheet = await page.addStyleTag({ content: catalog });
        const structure = await tokenSheet.evaluate(element => [...element.sheet.cssRules].map(rule => ({ selector: rule.selectorText, properties: [...rule.style] })));
        assert.equal(structure.length, 1);
        assert.equal(structure[0].selector, '.canvia-tokens');
        assert.ok(structure[0].properties.every(property => property.startsWith('--canvia-')));
        const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><main><h1>Control sintético de cascada</h1><p>Texto de prueba</p><div class="card"><div class="card-head">Cabecera</div><div class="card-body"><label>Campo <input value="Ejemplo"></label><button>Acción</button></div></div><table><tr><th>Columna</th></tr><tr><td>Dato ficticio</td></tr></table><svg width="32" height="32"><rect width="32" height="32" fill="#12633F"/></svg><canvas width="32" height="32"></canvas></main></body></html>';
        const snapshot = () => page.evaluate(() => [...document.querySelectorAll('html,body,main,h1,p,.card,.card-head,.card-body,label,input,button,table,th,td,svg,rect,canvas')].map(element => {
            const style = getComputedStyle(element);
            return { tag: element.tagName, styles: Object.fromEntries([...style].map(key => [key, style.getPropertyValue(key)])), rect: element.getBoundingClientRect().toJSON() };
        }));
        for (const width of [390, 768, 1440]) {
            for (const reducedMotion of ['no-preference', 'reduce']) {
                await page.setViewportSize({ width, height: 900 });
                await page.emulateMedia({ reducedMotion });
                await page.setContent(html);
                const sheet = await page.addStyleTag({ content: offline(before) });
                const oldStyles = await snapshot();
                const oldPng = await page.screenshot();
                await sheet.evaluate(element => element.remove());
                await page.addStyleTag({ content: offline(after) });
                assert.deepEqual(await snapshot(), oldStyles);
                assert.deepEqual(await page.screenshot(), oldPng);
                comparisons.push({ width, reducedMotion, computedStylesEqual: true, pixelsEqual: true });
            }
        }
        const resolved = await page.evaluate(({ expected, gradients }) => {
            const root = document.createElement('section');
            root.className = 'canvia-tokens';
            const child = document.createElement('span');
            root.append(child);
            document.body.append(root);
            const result = {};
            const rootStyle = getComputedStyle(root);
            for (const key of Object.keys(expected)) {
                const actual = rootStyle.getPropertyValue(key).trim();
                if (!actual || getComputedStyle(child).getPropertyValue(key).trim() !== actual) throw Error('Token o herencia ausente: ' + key);
                if (getComputedStyle(document.body).getPropertyValue(key) || getComputedStyle(document.querySelector('main')).getPropertyValue(key)) throw Error('Fuga de token: ' + key);
                if (!key.includes('gradient-')) result[key] = actual;
            }
            for (const [name, gradient] of Object.entries(gradients)) {
                root.style.background = 'var(--canvia-gradient-aurora-' + name + ')';
                const actual = [rootStyle.backgroundImage, rootStyle.backgroundColor];
                root.style.background = gradient;
                if (JSON.stringify(actual) !== JSON.stringify([rootStyle.backgroundImage, rootStyle.backgroundColor])) throw Error('Gradiente distinto: ' + name);
            }
            root.remove();
            return result;
        }, { expected, gradients });
        for (const [key, value] of Object.entries(resolved)) assert.equal(normalize(value), normalize(expected[key]), key);
        save('validacion.json', { passed: true, tokens: declarations.length, normativeSource: 'docs/DESIGN_SYSTEM.md v2.0', protectedFiles: protectedFiles.size, reports: reportChecks, cascade: comparisons, browser: browser.version(), consumersAdded: 0, integrated: 'Bloqueado según control-previo.json. Sin cambios de plantillas ni consumidores.' });
        save('inventario-tokens.json', expected);
        console.log(JSON.stringify({ passed: true, tokens: declarations.length, protectedFiles: protectedFiles.size, reports: reportChecks, cascadeChecks: comparisons.length }));
    } finally {
        await browser.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
