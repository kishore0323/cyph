#!/bin/bash


source ~/.bashrc

sudo apt-get -y --allow-downgrades update
sudo apt-get -y --allow-downgrades upgrade
sudo apt-get -y --allow-downgrades clean

sudo gem update

while [ ! -d ~/brotli ] ; do
	git clone https://github.com/google/brotli.git ~/brotli
done
cd ~/brotli
git pull
make clean
make brotli
sudo mv bin/brotli /usr/bin/

while [ ! -d ~/easyoptions ] ; do
	git clone https://github.com/renatosilva/easyoptions.git ~/easyoptions
done
cd ~/easyoptions
git pull
chmod -R 777 .

emsdk update
emsdk install latest
emsdk uninstall $(emsdk list | grep INSTALLED | perl -pe 's/\(?\*\)?//g' | grep node | awk '{print $1}')
emsdk activate latest

~/google-cloud-sdk/install.sh \
	--additional-components app-engine-go cloud-datastore-emulator \
	--command-completion false \
	--path-update false \
	--usage-reporting false

source ~/.bashrc

gcloud components update --quiet

echo | haxelib update > /dev/null

touch ~/.updated
