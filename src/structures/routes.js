const createCustomAlert = (message, status) => {
    // Cria um elemento de alerta personalizado
    const alertElement = document.createElement('div');
    alertElement.classList.add('custom-alert');
    alertElement.textContent = message;
  
    // Define as cores do alerta com base no status
    if (status === 'success') {
        alertElement.style.backgroundColor = '#d4edda';
        alertElement.style.color = '#155724';
        alertElement.style.border = '1px solid #c3e6cb';  
    } else if (status === 'warning') {
        alertElement.style.backgroundColor = '#fff3cd';
        alertElement.style.color = '#856404';
        alertElement.style.border = '1px solid #ffeeba';  
    } else if (status === 'danger') {
        alertElement.style.backgroundColor = '#f8d7da';
        alertElement.style.color = '#721c24';
        alertElement.style.border = '1px solid #f5c6cb';  
    }

    // Adiciona o alerta ao corpo da página
    document.body.appendChild(alertElement);
    
    // Adiciona a classe `show` para a transição
    setTimeout(() => {
        alertElement.classList.add('show');
    }, 10);

    // Define um tempo para remover o alerta após alguns segundos
    setTimeout(() => {
        alertElement.classList.remove('show');
        setTimeout(() => {
            alertElement.remove();
        }, 500); // Tempo para a transição de saída
    }, 6200); // Remove o alerta após 7 segundos (ajuste conforme necessário)
};


/**
 * Função que faz requisição para porta 3000 para fechamento ao app Electron.js
 */
function closeApp(){
    fetch('http://localhost:3000/closeApp')
        .then(response => response.text())
        .then(data => {
            console.log(data);
        })
        .catch(error => {
            console.error(error);
        });
}


/**
 * Função que faz requisição para porta 3000 para fechamento do app Electron.js
 */
function minimizeApp(){
    fetch('http://localhost:3000/minimizeApp')
        .then(response => response.text())
        .then(data => {
            console.log(data);
        })
        .catch(error => {
            console.error(error);
        });
}


/**
 * Função de requisição para porta 3000 para gravar dados do cadastro de informações do Saurus
 */
async function saveSaurus() {
    let chave = document.getElementById('chaveCaixa-input').value;
    let dominio = document.getElementById('dominio-input').value;
    let logoInput = document.getElementById('logo-input').files[0];

    if (!logoInput) {
        createCustomAlert('Por favor, selecione uma imagem.', 'warning');
        return;
    }

    let reader = new FileReader();
    reader.onload = async function(e) {
        let base64Image = e.target.result;

        try {
            const response = await fetch(`http://localhost:3000/saveSaurus`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chave: chave,
                    dominio: dominio,
                    logo: base64Image
                })
            });

            if (response.ok) {
                const message = await response.text();
                createCustomAlert("Informações foram salvas com sucesso!", 'success');
                carregarInfoSaurus()
            } else {
                const errorMessage = await response.text();
                createCustomAlert('AVISO: Confirme se a imagem possui resolução igual ou inferior a 900x900. Caso erro persista e impossibilite ou cause problemas na geração das impressões, entre em contato com suporte técnico para averiguação deste erro', 'danger');
            }
        } catch (error) {
            console.error('Erro ao realizar a requisição:', error);
            createCustomAlert('AVISO: Confirme se a imagem possui resolução igual ou inferior a 900x900. Caso erro persista e impossibilite ou cause problemas na geração das impressões, entre em contato com suporte técnico para averiguação deste erro', 'danger');
        }
    }

    reader.readAsDataURL(logoInput);
}



/**
 * Função de requisição para porta 3000 para gravar dados do cadastro de informações do Saurus
 */
async function gerarRelatorio() {
    let chave = document.getElementById('chave-orcamento-input').value;
    
    const form = document.getElementById('formularioFull-chave');
    const inputs = form.querySelectorAll('input, button');
    inputs.forEach(input => input.disabled = true);

    const loading = document.getElementById('loading');
    loading.style.display = 'flex';

    try {
        const response = await fetch(`http://localhost:3000/gerarRelatorio/${chave}`);
        const message = await response.text();

        console.log('Resposta do servidor:', message);
        
        if (response.ok) {
            if(message=="nao_encontrado"){
                createCustomAlert("Não foi encontrado um orçamento com a id da movimentação informada, reveja os dados.", 'warning');
            }
            else if(message=="sucesso"){
                createCustomAlert("O relatório do seu orçamento foi gerado e salvo com sucesso!", 'success');
            }
            
        } else {
            createCustomAlert(message, 'danger');
        }
    } catch (error) {
        console.error('Erro ao realizar a requisição:', error);
        createCustomAlert('Erro ao gerar relatório, entre em contato com suporte técnico para averiguacao deste erro', 'danger');
    } finally {
        inputs.forEach(input => input.disabled = false);
        loading.style.display = 'none';
        document.getElementById('chave-orcamento-input').value = ''; // Limpar o input
    }
}


/**
 * Função de requisição para porta 3000 para carregar valores dos campos "value" dos inputs HTML Saurus
 */
function carregarInfoSaurus(){
    fetch('http://localhost:3000/carregarInfo')
    .then(response => response.json())
    .then(dados =>{
        document.getElementById('chaveCaixa-input').value = dados[0];
        document.getElementById('dominio-input').value = dados[1];

        const logoElement = document.getElementById('logo-img');
        if (dados[2]) {
            logoElement.src = dados[2];
            logoElement.style.display = 'block'; // Torna a imagem visível
        } else {
            logoElement.style.display = 'none'; // Oculta a imagem se não houver logo
        }
    });
}


/**
 * Função de requisição para porta 3000 para carregar valor do campo data como horario atual
 */
function carregarData(){
    let data = new Date();
    data.setHours(data.getHours() - 3);
    document.getElementById('datetime-input').value = data.toISOString().slice(0, 16);;
}


/**
 * Função para rodar funções no carregamento das paginas
 */
window.onload = function(){
    carregarInfoSaurus();
};

