sudo yum install -y ruby-devel git screen vim
sudo yum groupinstall -y "Development Tools"
cp .rdebugrc ../
cp .bashrc ../
cp screen/.screenrc ../
cp vim/.vimrc ../
cp -rf vim/ ../.vim
git config --global user.name "Eric D. Helms"
git config --global user.email ericdhelms@gmail.com
mkdir ../workspace
\curl -L https://get.rvm.io | bash -s stable --ruby
source ~/.bashrc
