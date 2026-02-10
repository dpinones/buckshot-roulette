                                                               
 1. Clonar repo y entrar a agents                                                     
   ```bash                                                                            
     git clone https://github.com/dpinones/buckshot-roulette                          
     cd buckshot-roulette/agents                                                      
   ```                                                                                
 2. Copiar el skill al workspace (estructura local de OpenClaw)                       
   ```bash                                                                            
     mkdir -p /data/workspace/skills/buckshot-roulette/{game,scripts}                 
     cp -a agents/. /data/workspace/skills/buckshot-roulette/game/                    
     cp openclaw/SKILL.md /data/workspace/skills/buckshot-roulette/SKILL.md           
     cp -a openclaw/scripts/. /data/workspace/skills/buckshot-roulette/scripts/       
   ```                                                                                
 3. .env con tus claves/contratos                                                     
 Crear /data/workspace/skills/buckshot-roulette/game/.env con el contenido que me     
 pasaste (RPC_URL, direcciones de contratos, claves privadas y                        
 BUY_IN/POLL_INTERVAL/etc.).                                                          
 4. Instalar deps y verificar CLI                                                     
   ```bash                                                                            
     bash /data/workspace/skills/buckshot-roulette/scripts/setup.sh                   
   ```                                                                                
   (Esto corre npm install y npx tsx src/cli.ts --help para asegurar que todo         
 compile).                                                                            
 5. Comandos de prueba manual                                                         
     - Ver agentes:                                                                   
       ```bash                                                                        
         cd /data/workspace/skills/buckshot-roulette/game                             
         npx tsx src/cli.ts agents                                                    
       ```                                                                            
     - Estado actual:                                                                 
       ```bash                                                                        
         npx tsx src/cli.ts game-status                                               
       ```                                                                            
     - Leer estado completo (ej. agente 3 en juego 0):                                
       ```bash                                                                        
         npx tsx src/cli.ts read-state 0 3                                            
       ```                                                                            
     - Unirte a la cola (agente i):                                                   
       ```bash                                                                        
         npx tsx src/cli.ts join-queue i                                              
       ```                                                                            
     - Crear partida una vez que los 5 agentes están en cola:                         
       ```bash                                                                        
         npx tsx src/cli.ts start-game                                                
       ```                                                                            
     - Acciones en turno (items/tiros):                                               
       ```bash                                                                        
         npx tsx src/cli.ts use-item <gameId> <agentIndex> <itemIndex>                
         npx tsx src/cli.ts shoot-self <gameId> <agentIndex>                          
         npx tsx src/cli.ts shoot-opponent <gameId> <agentIndex> <addr>               
       ```                                                                            
 6. Fondos para las wallets                                                           
 Cada vez que hagas pruebas, fondeá los cinco agentes con el faucet testnet (misma    
 dirección/clave que en el .env). Ejemplo:                                            
   ```bash                                                                            
     curl -X POST https://agents.devnads.com/v1/faucet \                              
       -H "Content-Type: application/json" \                                          
       -d '{"chainId":10143,"address":"0x3904c58638B843722E9853e156b68e52A945AbBe"}'  
   ```                                                                                
 7. Loop autónomo local (una vez que verificás manualmente)                           
     - Para correr el watcher/loop a mano:                                            
       ```bash                                                                        
         npx tsx src/index.ts                                                         
       ```                                                                            
     - Si querés volver a automatizar en OpenClaw, me avisas y re-habilitamos el cron 
 buckshot-roulette-autoloop (cada 5s).                                                
                                                                                      
 Avisame cuando quieras reiniciar el bot en OpenClaw o si necesitás ayuda             
 interpretando algún comando/log durante tus pruebas locales.                         