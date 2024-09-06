const express = require('express');
const bodyParser = require('body-parser');
const { app, BrowserWindow, ipcMain, dialog, nativeImage, Tray, Menu } = require("electron");
const { gerarRelatorioOrcamento } = require('./structures/retMovimentacoes.js');
const { salvarDados, retornarDados } = require('./structures/manipulacaoJSON');
const path = require("path");
const fs = require('fs');

const expss = express();

// Middleware para processar JSON
expss.use(bodyParser.json());

// Configuração do Express
expss.get('/closeApp', (req, res) => {
    console.log('Função de fechamento do APP executada!');
    app.quit();
});

expss.get('/minimizeApp', (req, res) => {
    if (win) {
        win.minimize();
    }
    res.status(200).send('Aplicativo minimizado');
});

expss.get(`/gerarRelatorio/:chave`, async (req, res) => {
    const chave = req.params.chave;

    try {
        const retorno = await gerarRelatorio(chave);
        if (retorno == "pdf_gerado") {
            res.status(200).send("sucesso");
        } else if (retorno == "nao_encontrado") {
            res.status(200).send("nao_encontrado");
        } else {
            res.status(500).send('Erro ao gerar relatório');
        }
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).send('Erro ao gerar relatório');
    }
});

expss.post(`/saveSaurus`, (req, res) => {
    const { chave, dominio, logo } = req.body;

    salvarDados(chave, dominio, logo, 'saurus')
        .then((response) => {
            res.status(200).send('Informações foram salvas com sucesso!');
        })
        .catch((error) => {
            console.error('Erro ao salvar dados:', error);
            res.status(500).send('Erro ao atualizar dados');
        });
});

expss.get(`/carregarInfo`, (req, res) => {
    retornarDados()
        .then((dadosRetorno) => {
            res.json(dadosRetorno);
        })
        .catch((err) => {
            console.error('Erro ao retornar dados:', err);
        });
});

expss.listen(3000, () => {
    console.log('Servidor Express iniciado na porta 3000');
});

/* Configuração do Electron */

let win = null;
let tray = null;

function createWindow() {
    const icon = nativeImage.createFromPath(`${app.getAppPath()}/build/icon.jpg`);

    if (app.dock) {
        app.dock.setIcon(icon);
    }

    win = new BrowserWindow({
        icon,
        width: 650,
        height: 400,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Desabilita o isolamento de contexto
        },
    });

    win.loadFile("./index.html");

    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Abrir', click: () => win.show() },
        { label: 'Fechar', click: () => app.quit() }
    ]);
    tray.setToolTip('Relatório');
    tray.setContextMenu(contextMenu);

    win.on('close', (event) => {
        event.preventDefault();
        win.hide();
    });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

async function gerarRelatorio(numeroDocumento) {
    return new Promise(async (resolve, reject) => {
        var informacoesDoOrcamento;
        var naoGerar = false;

        await gerarRelatorioOrcamento(numeroDocumento)
            .then((response) => {
                if (response == "nao_encontrado") {
                    resolve(response);
                    naoGerar = true;
                } else {
                    informacoesDoOrcamento = response;
                }
            });

        const pdfWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } });
        const dadosUser = fs.readFileSync('./src/build/dados.json', 'utf-8');
        
        const filePath = path.join(__dirname, './page_impressao/index.html');
        pdfWindow.loadFile(filePath);

        pdfWindow.webContents.on('did-finish-load', async () => {
            try {
                await pdfWindow.webContents.executeJavaScript(`
                    (async function() {
                        try {
                            const data = ${JSON.stringify(informacoesDoOrcamento)};
                            const dados = ${dadosUser};
                            
                            const logoEmpresa = document.getElementById("logo_empresa");
                            logoEmpresa.src = dados.dadosApp.saurus.logo;
                            document.getElementById("dataEmissao").innerText = data.emissaoData;
                            document.getElementById("numero_orcamento").innerText = data.orcamentoNumero;

                            document.getElementById("cnpj_emitente").innerText = data.emitente.cnpj;
                            document.getElementById("endereco_emitente").innerText = data.emitente.endereco;
                            document.getElementById("fone_emitente").innerText = data.emitente.fone;

                            document.getElementById("cnpj_destinatario").innerText = data.destinatario.cnpj;
                            document.getElementById("fantasia_destinatario").innerText = data.destinatario.fantasia;
                            document.getElementById("fone_destinatario").innerText = data.destinatario.fone;
                            document.getElementById("endereco_destinatario").innerText = data.destinatario.endereco;
                            document.getElementById("cidade_destinatario").innerText = data.destinatario.cidade;

                            document.getElementById("total_descontos").innerText = "R$ " + data.totais.descontos;
                            document.getElementById("total_produtos").innerText = "R$ " + data.totais.produtos;
                            document.getElementById("valor_total").innerText = "R$ " + data.totais.valor;

                            const tabelaProdutos = document.getElementById("produtos");

                            let produtosValidos = data.produtos.filter(produto => produto !== null && typeof produto === 'object');

                            for (const produto of produtosValidos) {
                                const rowHTML = \`
                                    <tr>
                                        <td>\${produto.codigo}</td>
                                        <td><img src="\${produto.imagem}" alt="Produto" width="64" height="64"></td>
                                        <td>\${produto.produto}</td>
                                        <td>\${produto.vendedor}</td>
                                        <td>\${produto.med}</td>
                                        <td>\${produto.quantidade}</td>
                                        <td>\${produto.valor_unitario}</td>
                                        <td>\${produto.valor_total}</td>
                                    </tr>
                                \`;

                                tabelaProdutos.innerHTML += rowHTML;
                            }
                        } catch (error) {
                            console.error('Erro ao buscar dados:', error);
                        }
                    })();
                `);

                // Configuração para impressão em modo paisagem
                // Esperar 5 segundos antes de gerar o PDF
                setTimeout(async () => {
                    try {
                        const pdf = await pdfWindow.webContents.printToPDF({ landscape: true });

                        // Verifica se a janela ainda está aberta
                        if (!pdfWindow.isDestroyed() && !naoGerar) {
                            pdfWindow.close();

                            const options = {
                                title: 'Salvar PDF',
                                defaultPath: path.join(app.getPath('documents'), `Orçamento ${numeroDocumento}.pdf`),
                                filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
                            };

                            dialog.showSaveDialog(win, options).then(result => {
                                if (!result.canceled && result.filePath) {
                                    fs.writeFileSync(result.filePath, pdf);
                                    resolve('pdf_gerado');
                                } else {
                                    reject(new Error('Ação de salvar PDF cancelada pelo usuário'));
                                }
                            }).catch(error => {
                                reject(error);
                            });
                        } else {
                            reject(new Error('Janela fechada antes do PDF ser gerado'));
                        }
                    } catch (error) {
                        pdfWindow.close();
                        reject(error);
                    }
                }, 5000); // Atraso de 5 segundos (5000 milissegundos)

            } catch (error) {
                pdfWindow.close();
                reject(error);
            }
        });

    });
}
