set nocompatible               " no vi compatible mode
 
" using vundle to load all plugins
if filereadable(expand("~/.vundle"))
  source ~/.vundle
endif

colorscheme vibrantink

autocmd BufWritePre  *.{js,rb,scss}  call StripTrailingWhite()
au BufRead,BufNewFile *.rabl setf ruby
au BufRead,BufNewFile *.rabl syn keyword rubyRabl node attribute object child collection attributes glue extends
au BufRead,BufNewFile *.rabl hi def link rubyRabl Function

function! StripTrailingWhite()
    let l:winview = winsaveview()
    silent! %s/\s\+$//
    call winrestview(l:winview)
endfunction

set tabpagemax=75
