"""" Enable Plug: vim plugin manager

" required before Vundle initialization
set nocompatible        " disable compatibility mode with vi
filetype off            " disable filetype detection (but re-enable later, see below)

" set the runtime path to include Plug, and initialize
call plug#begin('~/.vim/plugged')

"Plug 'leafgarland/typescript-vim'
"Plug 'pearofducks/ansible-vim'
"Plug 'rodjek/vim-puppet'
Plug 'sheerun/vim-polyglot'
"Plug 'pangloss/vim-javascript'

call plug#end()


"""" Basic Behavior

"set number              " show line numbers
set wrap                " wrap lines
set encoding=utf-8      " set encoding to UTF-8 (default was "latin1")
set mouse=a             " enable mouse support (might not work well on Mac OS X)
set wildmenu            " visual autocomplete for command menu
set lazyredraw          " redraw screen only when we need to
set showmatch           " highlight matching parentheses / brackets [{()}]
set laststatus=2        " always show statusline (even with only single window)
set ruler               " show line and column number of the cursor on right side of statusline
set visualbell          " blink cursor on error, instead of beeping


"""" Key Bindings


"""" Vim Appearance

" put colorscheme files in ~/.vim/colors/
colorscheme badwolf

" use filetype-based syntax highlighting, ftplugins, and indentation
syntax enable
filetype plugin indent on


"""" Tab settings

set autoindent          " copy indent from current line when starting a new line
set smartindent         " even better autoindent (e.g. add indent after '{')

set tabstop=2           " number of spaces per <TAB>
set shiftwidth=2        " set a <TAB> key-press equal to 4 spaces

set paste
set expandtab           " convert <TAB> key-presses to spaces

set tabpagemax=75

"""" Search settings

set incsearch           " search as characters are entered
set hlsearch            " highlight matches

" turn off search highlighting with <CR> (carriage-return)
nnoremap <CR> :nohlsearch<CR><CR>

"""" Miscellaneous settings that might be worth enabling

"set cursorline         " highlight current line
"set background=dark    " configure Vim to use brighter colors
"set autoread           " autoreload the file in Vim if it has been changed outside of Vim

function! StripTrailingWhite()
    let l:winview = winsaveview()
    silent! %s/\s\+$//
    call winrestview(l:winview)
endfunction

autocmd BufWritePre  *  call StripTrailingWhite()

" highlight Normal ctermbg=none
" highlight NonText ctermbg=none

"au BufRead,BufNewFile *.rabl setf ruby
"au BufRead,BufNewFile Vagrantfile setf ruby
"au BufRead,BufNewFile *.rabl syn keyword rubyRabl node attribute object child collection attributes glue extends
"au BufRead,BufNewFile *.rabl hi def link rubyRabl Function
"au BufNewFile,BufRead *.groovy  setf groovy
"au BufNewFile,BufRead Jenkinsfile setf groovy
"au BufRead,BufNewFile *.yml setf ansible
"au BufRead,BufNewFile *.yaml setf ansible
