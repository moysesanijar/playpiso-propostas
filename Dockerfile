FROM node:20-bookworm-slim

# Instala Python 3 e venv
RUN apt-get update && \
    apt-get install -y python3 python3-venv python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Define o diretório de trabalho
WORKDIR /app

# Copia arquivos do Node e instala dependências
COPY package*.json ./
RUN npm ci

# Configura o ambiente virtual Python e instala dependências
COPY requirements.txt ./
RUN python3 -m venv venv
RUN ./venv/bin/pip install -r requirements.txt

# Copia o resto do código da aplicação
COPY . .

# Garante que a pasta de outputs existe para evitar erros
RUN mkdir -p outputs/propostas

# Porta padrão
EXPOSE 3000

# Inicia a aplicação
CMD ["node", "server/index.js"]
