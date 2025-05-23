# NodeTrack

to run the client:

```python
python run_script_as_service.py client/collect.py start --name nodetrack_client
```

to check its status:

```python
python run_script_as_service.py client/collect.py status --name nodetrack_client
```

to stop:

```python
python run_script_as_service.py client/collect.py stop --name nodetrack_client
```

for help:
```python
python run_script_as_service.py client/collect.py -h
```

to reset VITE env vars:
```bash
for var in ${(k)parameters}; do [[ $var == VITE_* ]] && unset $var; done
```

to run the master stack using docker-compose, use:

```bash
docker-compose -f docker-compose-master.yml down; docker-compose -f docker-compose-master.yml up -d --build;
```