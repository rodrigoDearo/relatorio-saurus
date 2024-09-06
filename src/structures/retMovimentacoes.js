/* ---------------------- IMPORTAÇÃO DE MÓDULOS ----------------------*/
const { codificarInBase64, decodificarEsalvar } = require('./tratamentoDados');
const { retornaCampo } = require('./manipulacaoJSON');
const axios = require('axios');
const xml2js = require('xml2js');
const zlib = require('zlib')



var Dominio, ChaveCaixa, xBytesParametrosRetCadastros, xBytesParametrosRetMovimentacao, Password, DateTime, minutos, segundos; 
var dadosDoOrcamento = {
  "emissaoData": "",
  "orcamentoNumero": "",
  "logo": "",
  "emitente": {
      "cnpj": "",
      "endereco": "",
      "fone": ""
  },
  "destinatario": {
      "cnpj": "",
      "fantasia": "",
      "endereco": "",
      "fone": "",
      "cidade": ""
  },
  "totais": {
      "valor": '',
      "descontos": '',
      "produtos": ''
  },
  "produtos": []
}


/**
 * Define a senha para ser enviada na requisição para consumir WebService Saurus
 * @returns {senha} no padrão consultado com desenvolvdedores do software
 */
function setSenha() {
  let dataAtual = new Date();
  let dia = dataAtual.getDate();
  let mes = dataAtual.getMonth();
  let ano = dataAtual.getFullYear() + 1;

  let senha = `ophd02ophd02|@${dia + mes + ano - 2000}|${Dominio}|1`;
  senha = senha.toString();
  return senha;
}


/**
 * Fução assíncrona para atribuir valor da chaveCaixa com base no retorno da função retornarCampo
 */
async function getChaveCaixa() {
  try {
    let chaveRetorno = await retornaCampo('chave');
    ChaveCaixa = chaveRetorno;
  } catch (err) {
    gravarLogErro('Erro ao retornar dados:', err);
  }
}


/**
 * Fução assíncrona para atribuir valor do Dominio com base no retorno da função retornarCampo
 */
async function getDominio() {
  try {
    let dominioRetorno = await retornaCampo('dominio');
    Dominio = dominioRetorno;
  } catch (err) {
    gravarLogErro('Erro ao retornar dados:', err);
  }
}


/**
 * Fução assíncrona para codificar a string do xml a ser enviado para requisição retMovimentacoes, em formato 64x bytes (padrão solicitado para ser enviado o xBytes)
 */
async function codificarXmlRetMovimentacoes() {
  try {
    xBytesParametrosRetMovimentacao = codificarInBase64(`<xmlIntegracao>
      <Dominio>${Dominio}</Dominio>
      <TpMov>35</TpMov>
      <IndStatus>0</IndStatus>
      <xNome>%</xNome>
      <DInicial>2000-01-01 00:00:00</DInicial>
      <DFinal>${DateTime}</DFinal>
</xmlIntegracao>`);
  } catch (err) {
    gravarLogErro('Erro ao codificar xmlRetMovimentacoes:', err);
  }
}


/**
 * Fução assíncrona para codificar a string do xml a ser enviado para requisição retCadastros, em formato 64x bytes (padrão solicitado para ser enviado o xBytes)
 */
async function codificarXmlRetCadastros() {
  try {
    xBytesParametrosRetCadastros = codificarInBase64(`<xmlIntegracao>
      <Dominio>${Dominio}</Dominio>
      <TpArquivo>50</TpArquivo>
      <ChaveCaixa>${ChaveCaixa}</ChaveCaixa>
      <TpSync>0</TpSync>
      <DhReferencia>2000-01-01T00:00:00-03:00</DhReferencia>
</xmlIntegracao>`);
  } catch (err) {
    gravarLogErro('Erro ao codificar retCadastros:', err);
  }
}


/**
 * Função para codificar a senha en base 64 para ser enviada no corpo da requisição e consumo do WebService
 */
async function codificarSenha() {
  try {
    Password = codificarInBase64(setSenha());
  }
  catch (err) {
    console.err('Erro ao codificar Senha:', err);
  }
}

async function gerarRelatorioOrcamento(chave){
  return new Promise(async (resolve, reject) => {
    var movimentacoes;
    var cadastros;

    await retMovimentacao()
    .then(async (response_mov) => {
      movimentacoes = response_mov;

      await retCadastros()
      .then(async (response_cad) => {
        cadastros = response_cad;
      }) 
    })
    .then(async () => {
      await achandoEFiltrandoInformacoesOrcamento(movimentacoes, cadastros, chave)
      .then((response) => {
        if(response=="nao_encontrado"){
          resolve(response)
        }
        else{
          resolve(dadosDoOrcamento)
        }
      })
    })
  })
}


/**
 * Função que realiza a requisção POST para o WebSevice retMovimentacao através da biblioteca Axios
 * @param {*} Sync paramêtro informado para realização da requisição (explicação dos valores passados a Sync são explicados na documentação)
 */
async function retMovimentacao() {
  return new Promise((resolve, reject) => {
    getChaveCaixa()
      .then(() => getDominio())
      .then(() => codificarSenha())
      .then(() => codificarXmlRetMovimentacoes())
      .then(async () => {
        const headers = {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://saurus.net.br/retMovimentacoes'
        }

        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <retMovimentacoes xmlns="http://saurus.net.br/">
              <xBytesParametros>${xBytesParametrosRetMovimentacao}</xBytesParametros>
              <xSenha>${Password}</xSenha>
            </retMovimentacoes>
          </soap:Body>
        </soap:Envelope>`
        
        const response = await axios.post('http://wsretaguarda.saurus.net.br/v001/serviceRetaguarda.asmx', body, { headers });

        xml2js.parseString(response.data, async (err, result) => {
          if (err) {
            console.log('REQUISICAO DE VENDAS MAL SUCEDIDA');
          } else {
            console.log('REQUISICAO DE VENDAS BEM SUCEDIDA');
            const base64Data = result['soap:Envelope']['soap:Body'][0]['retMovimentacoesResponse'][0]['retMovimentacoesResult'][0];
            
            // Decode base64
            const buffer = Buffer.from(base64Data, 'base64');
    
            // Decompress Gzip
            zlib.gunzip(buffer, (err, decompressedBuffer) => {
              if (err) {
                console.log('Erro ao descompactar:', err);
              } else {
                const decompressedXml = decompressedBuffer.toString('utf-8');
                
                // Parse XML
                xml2js.parseString(decompressedXml, (err, parsedResult) => {
                  if (err) {
                    console.log('Erro ao parsear XML:', err);
                  } else {
                    resolve(parsedResult)
                  }
                });
              }
            });
           }
          })

      })
      .catch((error) => {
        console.log(error)
        gravarLogErro('Erro ao obter dados:', error);
      });
  });
}


/**
 * Função que realiza a requisção POST para o WebSevice retCadastros através da biblioteca Axios
 * @param {*} Sync paramêtro informado para realização da requisição (explicação dos valores passados a Sync são explicados na documentação)
 */
async function retCadastros() {
  return new Promise((resolve, reject) => {
    getChaveCaixa()
      .then(() => getDominio())
      .then(() => codificarSenha())
      .then(() => codificarXmlRetCadastros())
      .then(async () => {
        const headers = {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://saurus.net.br/retCadastros'
        }

        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <retCadastros xmlns="http://saurus.net.br/">
              <xBytesParametros>${xBytesParametrosRetCadastros}</xBytesParametros>
              <xSenha>${Password}</xSenha>
            </retCadastros>
          </soap:Body>
        </soap:Envelope>`
        
        const response = await axios.post('http://wscadastros.saurus.net.br/v001/serviceCadastros.asmx', body, { headers });

        xml2js.parseString(response.data, async (err, result) => {
          if (err) {
            console.log('REQUISICAO DE CADASTROS MAL SUCEDIDA');
          } else {
            console.log('REQUISICAO DE CADASTROS BEM SUCEDIDA');
            const base64Data = result['soap:Envelope']['soap:Body'][0]['retCadastrosResponse'][0]['retCadastrosResult'][0];
    
            // Decode base64
            const buffer = Buffer.from(base64Data, 'base64');
    
            // Decompress Gzip
            zlib.gunzip(buffer, (err, decompressedBuffer) => {
              if (err) {
                console.log('Erro ao descompactar:', err);
              } else {
                const decompressedXml = decompressedBuffer.toString('utf-8');

                // Parse XML
                xml2js.parseString(decompressedXml, (err, parsedResult) => {
                  if (err) {
                    console.log('Erro ao parsear XML:', err);
                  } else {
                    resolve(parsedResult)
                  }
                });
              }
            });
           }
          })

      })
      .catch((error) => {
        console.log(error)
        gravarLogErro('Erro ao obter dados:', error);
      });
  });
}


async function achandoEFiltrandoInformacoesOrcamento(xmlMovimentacao, xmlCadastros, numeroDocumento) {
  return new Promise(async (resolve, reject) => {
    try {
      const movDadosArray = xmlMovimentacao.retConsutaMov.MovDados;
      const produtosCadastrados = xmlCadastros.cadastros.tbProdutoDados[0].row;
      const dadosCadastrados = xmlCadastros.cadastros.tbCadastroDados[0].row;
      const ncmsCadastrados = xmlCadastros.cadastros.tbProdutoNcms[0].row;
      const impostosCadastrados = xmlCadastros.cadastros.tbProdutoImpostos[0].row;
      const imagensCadastradas = xmlCadastros.cadastros.tbProdutoImagens[0].row;
      const dadosLoja = xmlCadastros.cadastros.tbLojaDados[0].row;
  
      let totalDescontos = 0;
      let totalProdutos = 0;
  
      for (const movDados of movDadosArray) {
        if (movDados.$.mov_idMov == numeroDocumento) {
          let dataDeEmissao = await formatacaoData(movDados.$.mov_dhEmi);
          let valorTotalNfe = parseFloat(movDados.$.tot_vNF).toFixed(2);
          let valorTotalNfeComVirgula = valorTotalNfe.replace('.', ',');
  
          dadosDoOrcamento.emissaoData = dataDeEmissao;
          dadosDoOrcamento.orcamentoNumero = `${movDados.$.mov_nNf}`;
          dadosDoOrcamento.totais.valor = `${valorTotalNfeComVirgula}`;

          let {cnpjEmitente, foneEmitente, enderecoEmitente} = await preencherEmitenteInfo(dadosLoja, movDados.$.emit_idLoja)
          dadosDoOrcamento.emitente.cnpj = cnpjEmitente;
          dadosDoOrcamento.emitente.fone = foneEmitente;
          dadosDoOrcamento.emitente.endereco = enderecoEmitente;

          let {cnpjDestinatario, fantasiaDestinatario, enderecoDestinatario, foneDestinatario, cidadeDestinatario} = await preencherDestinatarioInfo(dadosCadastrados, movDados.$.dest_idCadastro)
          dadosDoOrcamento.destinatario.cnpj = cnpjDestinatario;
          dadosDoOrcamento.destinatario.fantasia = fantasiaDestinatario;
          dadosDoOrcamento.destinatario.endereco = enderecoDestinatario;
          dadosDoOrcamento.destinatario.fone = foneDestinatario;
          dadosDoOrcamento.destinatario.cidade = cidadeDestinatario;

          const produtos = movDados.Produtos[0].MovProd;
          for (const produto of produtos) {
            let idProduto = produto.$.prod_idProduto;
  
            let valorUnitario = ((parseFloat(produto.$.prod_vProd) + parseFloat(produto.$.prod_vDesc)) / parseFloat(produto.$.prod_qCom)).toFixed(2);
            let valorUnitarioComVirgula = valorUnitario.replace('.', ',');
  
            let quantidadeComprada = parseFloat(produto.$.prod_qCom).toFixed(2);
            let quantidadeCompradaComVirgula = quantidadeComprada.replace('.', ',');
  
            let valorTotal = parseFloat(produto.$.prod_vProd).toFixed(2);
            let valorTotalComVirgula = valorTotal.replace('.', ',');
  
            let imagemProduto = await encontrarImagemProduto(imagensCadastradas, idProduto);
            let { idNcm, idImposto } = await encontrarIdNcmEImposto(produtosCadastrados, idProduto);
  
            let ncmProduto = await encontrarNcm(ncmsCadastrados, idNcm);
            let cstProduto = await encontrarCST(impostosCadastrados, idImposto);
  
            dadosDoOrcamento.produtos[produto.$.prod_nItem] = {
              "codigo": produto.$.prod_cProd,
              "imagem": imagemProduto,
              "produto": produto.$.prod_xProd,
              "vendedor": produto.$.prod_loginVendedor,
              "ncm": ncmProduto,
              "cfop": produto.$.prod_cfop,
              "cst": cstProduto,
              "med": produto.$.prod_uCom,
              "quantidade": `${quantidadeCompradaComVirgula}`,
              "valor_unitario": `${valorUnitarioComVirgula}`,
              "valor_total": `${valorTotalComVirgula}`
            };
  
            totalDescontos += parseFloat(produto.$.prod_vDesc);
            totalProdutos += parseFloat(valorTotal)+parseFloat(produto.$.prod_vDesc);
          }
  
          let totaisDescontosComVirgula = totalDescontos.toFixed(2).replace('.', ',');
          let totaisProdutosComVirgula = totalProdutos.toFixed(2).replace('.', ',');
  
          dadosDoOrcamento.totais.descontos = totaisDescontosComVirgula;
          dadosDoOrcamento.totais.produtos = totaisProdutosComVirgula;
  
          resolve();
          return;
        }
      }
  
      console.log('Movimento não encontrado.');
      resolve("nao_encontrado");
    } catch (error) {
      console.log('Erro ao filtrar informações do orçamento:', error);
      reject(error);
    }
  });
}


async function encontrarImagemProduto(imagensCadastradas, idProduto) {
  for (const imagem of imagensCadastradas) {
    if (imagem.$.pro_idProduto == idProduto) {
      return imagem.$.pro_localImagem; // Supondo que o atributo da imagem seja 'pro_imagem'
    }
  }
  return '';
}


async function encontrarIdNcmEImposto(produtosCadastrados, idProduto) {
  for (const dadosProduto of produtosCadastrados) {
    if (dadosProduto.$.pro_idProduto == idProduto) {
      return {
        idNcm: dadosProduto.$.pro_idNcm,
        idImposto: dadosProduto.$.pro_idImposto
      };
    }
  }
  return {
    idNcm: '',
    idImposto: ''
  };
}


async function encontrarNcm(ncmsCadastrados, idNCM) {
  for (const ncms of ncmsCadastrados) {
    if (ncms.$.pro_idNcm == idNCM) {
      return ncms.$.pro_codigo; // Supondo que o atributo da imagem seja 'pro_imagem'
    }
  }
  return '';
}


async function encontrarCST(impostosCadastrados, idImposto) {
  for (const impostos of impostosCadastrados) {
    if (impostos.$.pro_idImposto == idImposto) {
      return impostos.$.pro_icms_cst; // Supondo que o atributo da imagem seja 'pro_imagem'
    }
  }
  return '';
}


async function preencherEmitenteInfo(lojasCadastradas, idLoja) {
  for (const loja of lojasCadastradas) {
    if (loja.$.loj_idLoja == idLoja) {
          let cnpj = loja.$.loj_doc
          let cnpjFormatado = cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
          let cnpjErazaoSocial = `${cnpjFormatado} - ${loja.$.loj_x005F_xNome}`;
          let telefone = `${loja.$.loj_fone}`;
          let endereco = `${loja.$.loj_x005F_xLgr} Nº${loja.$.loj_nro}, ${loja.$.loj_x005F_xCpl}, ${loja.$.loj_x005F_xBairro} - ${loja.$.loj_cep}`
      return {
        cnpjEmitente: cnpjErazaoSocial,
        foneEmitente: telefone,
        enderecoEmitente: endereco
      }
    }
  }
  return '';
}


async function preencherDestinatarioInfo(cadastros, idDestinatario) {
  for (const destinatario of cadastros) {
    if ((destinatario.$.cad_idCadastro == idDestinatario)&&(destinatario.$.cad_tpCadastro=="30")) {
      let cnpj = destinatario.$.cad_doc;
      let cnpjFormatado;
      let cnpjErazaoSocial;

      if((cnpj=="")||(cnpj==" ")){
        cnpjErazaoSocial = `${destinatario.$.cad_x005F_xNome}`;
      }
      else{
        cnpjFormatado = cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        cnpjErazaoSocial = `${cnpjFormatado} - ${destinatario.$.cad_x005F_xNome}`;
      }

      let fantasia = destinatario.$.cad_fant;
      let endereco = `${destinatario.$.cad_x005F_xLgr} Nº${destinatario.$.cad_nro}, ${destinatario.$.cad_x005F_xCpl}, ${destinatario.$.cad_x005F_xBairro} - ${destinatario.$.cad_cep}`;
      let telefone = `${destinatario.$.cad_tel}`;
      let cidade = `${destinatario.$.cad_x005F_xMun} - ${destinatario.$.cad_uf}`

      return {
        cnpjDestinatario: cnpjErazaoSocial,
        fantasiaDestinatario: fantasia,
        enderecoDestinatario: endereco,
        foneDestinatario:telefone,
        cidadeDestinatario: cidade
      }
    }
  }
  return '';
}

async function formatacaoData(data) {
  try {
      const date = new Date(data);
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
      const year = date.getFullYear();
      
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      
      return formattedDate; // Retorna diretamente o resultado formatado
  } catch (error) {
      console.log('Erro ao formatar data:', error);
      throw error; // Lança o erro caso ocorra algum problema na formatação da data
  }
}



module.exports = {
  gerarRelatorioOrcamento
};